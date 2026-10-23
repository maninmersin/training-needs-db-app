// Importing individual course assignments: one row per person per course ("long format").
// Per person the file lists the courses they should have. In "replace" mode the person ends up with exactly
// those courses (extra ones are removed); in "add only" mode nothing is removed. Existing people's details are
// never changed by this import; people who do not exist yet are created from the row's details.
// Only the differences are written, courses are added before any are removed, and each person is independent.
import { fetchAllRows } from '@core/utils/fetchAllRows';
import { matchColumns, rowToRecord } from './tableFile';
import { STATUS, canonicalMatch, countByStatus, explainDatabaseError, runOps } from './planning';

export const ASSIGNMENT_FIELDS = ['name', 'email', 'project_role', 'training_location', 'job_title', 'country', 'division', 'sub_division', 'location_name'];
export const ASSIGNMENT_COLUMNS = ['id', ...ASSIGNMENT_FIELDS, 'course_id'];
const ALIASES = {
  userid: 'id', user_id: 'id', employee_id: 'id', role: 'project_role', location: 'training_location', courseid: 'course_id',
  jobtitle: 'job_title', subdivision: 'sub_division', locationname: 'location_name'
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const chunk = (list, size) => {
  const parts = [];
  for (let i = 0; i < list.length; i += size) parts.push(list.slice(i, i + size));
  return parts;
};

export function assignmentPeopleIds(table) {
  const { columns } = matchColumns(table.headers, ASSIGNMENT_COLUMNS, ALIASES);
  const header = Object.keys(columns).find((name) => columns[name] === 'id');
  return header ? [...new Set(table.rows.map((row) => row.values[header]).filter((value) => /^\d+$/.test(value)).map(Number))] : [];
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Check an assignments file. `ctx` = { projectId, people: Map(id -> person, any project), courses: [course_ids in this project],
 * current: Map(id -> [course_ids already assigned]), locations: [names], roles: [names] }.
 * Options: { mode: 'replace' | 'add' }. Returns { fileProblems, ignoredColumns, items, tiles } with one item per person.
 */
export function planAssignmentsImport(table, ctx, { mode = 'replace' } = {}) {
  const { columns, ignored } = matchColumns(table.headers, ASSIGNMENT_COLUMNS, ALIASES);
  const have = new Set(Object.values(columns));
  const missing = ['id', 'course_id'].filter((name) => !have.has(name));
  if (missing.length > 0) {
    return {
      fileProblems: [`The file needs these columns: ${missing.map((name) => (name === 'id' ? 'UserID' : 'CourseID')).join(', ')}.`],
      ignoredColumns: ignored,
      items: [],
      tiles: []
    };
  }

  const items = [];
  const byPerson = new Map(); // id -> { rows: [{rowNumber, record}] }
  table.rows.forEach((row) => {
    const record = rowToRecord(row, columns);
    const rawId = (record.id ?? '').trim();
    const courseId = (record.course_id ?? '').trim();
    const rowError = (message) => items.push({ rowNumber: row.rowNumber, label: record.name?.trim() || `Row ${row.rowNumber}`, action: '', status: STATUS.ERROR, message, op: null });
    if (!/^\d+$/.test(rawId)) return rowError(rawId === '' ? 'UserID is required' : 'UserID must be a whole number');
    if (courseId === '') return rowError('CourseID is required');
    const id = Number(rawId);
    if (!byPerson.has(id)) byPerson.set(id, []);
    byPerson.get(id).push({ rowNumber: row.rowNumber, record, courseId });
  });

  byPerson.forEach((rows, id) => {
    const first = rows[0];
    const existing = ctx.people.get(id);
    const base = { rowNumber: first.rowNumber, label: existing?.name || first.record.name?.trim() || `ID ${id}` };
    const error = (message) => items.push({ ...base, action: '', status: STATUS.ERROR, message, op: null });

    if (existing && existing.project_id !== ctx.projectId) return error(`ID ${id} belongs to a person in another project`);

    const wanted = [];
    const unknown = [];
    rows.forEach(({ courseId }) => {
      const match = canonicalMatch(courseId, ctx.courses);
      if (!match) {
        if (!unknown.includes(courseId)) unknown.push(courseId);
      } else if (!wanted.includes(match)) {
        wanted.push(match);
      }
    });
    if (unknown.length > 0) return error(`Course${unknown.length === 1 ? '' : 's'} not found in this project: ${unknown.join(', ')} (import courses first)`);

    let create = null;
    const warnings = [];
    if (!existing) {
      const details = {};
      ASSIGNMENT_FIELDS.forEach((field) => {
        const value = rows.map((r) => (r.record[field] ?? '').trim()).find(Boolean);
        if (value) details[field] = value;
      });
      if (!details.name || !details.email) return error('Name and email are required for a new person');
      if (!EMAIL.test(details.email)) return error('Enter a full email address');
      if (details.training_location) {
        const match = canonicalMatch(details.training_location, ctx.locations);
        if (!match) return error(`Training location "${details.training_location}" is not in Reference Data (add it there first)`);
        details.training_location = match;
      }
      if (details.project_role) {
        const match = canonicalMatch(details.project_role, ctx.roles);
        if (match) details.project_role = match;
        else warnings.push(`Role "${details.project_role}" is not in Reference Data`);
      }
      create = { id, project_id: ctx.projectId, ...details };
    }

    const current = ctx.current.get(id) || [];
    const add = wanted.filter((courseId) => !current.includes(courseId));
    const remove = mode === 'replace' ? current.filter((courseId) => !wanted.includes(courseId)) : [];
    const status = warnings.length > 0 ? STATUS.WARNING : STATUS.OK;

    if (!create && add.length === 0 && remove.length === 0) {
      items.push({ ...base, action: 'Assign', status: STATUS.UNCHANGED, message: `No changes (${plural(wanted.length, 'course')} already assigned)`, op: null });
      return;
    }
    const parts = [];
    if (create) parts.push('New person');
    if (add.length > 0) parts.push(`add ${add.join(', ')}`);
    if (remove.length > 0) parts.push(`remove ${remove.join(', ')}`);
    if (warnings.length > 0) parts.push(`(${warnings.join('; ')})`);
    const text = parts.join(' - ');
    items.push({
      ...base,
      action: create ? 'Add' : 'Assign',
      status,
      message: text.charAt(0).toUpperCase() + text.slice(1),
      op: { type: 'assign', id, create, add, remove }
    });
  });

  items.sort((a, b) => a.rowNumber - b.rowNumber);
  const counts = countByStatus(items);
  const applying = items.filter((item) => item.op && item.status !== STATUS.ERROR);
  const tiles = [
    { label: 'People with changes', value: applying.length },
    { label: 'New people to create', value: applying.filter((i) => i.op.create).length },
    { label: 'Courses added', value: applying.reduce((total, i) => total + i.op.add.length, 0), tone: 'success' },
    { label: 'Courses removed', value: applying.reduce((total, i) => total + i.op.remove.length, 0), tone: 'danger' },
    { label: 'Cannot be imported', value: counts.error, tone: 'danger' },
    { label: 'No change', value: counts.unchanged }
  ].filter((tile, index) => index < 4 || tile.value > 0);

  return { fileProblems: [], ignoredColumns: ignored, items, tiles };
}

export async function loadAssignmentsContext(db, projectId, table) {
  const ids = assignmentPeopleIds(table);
  const [courses, locations, roles] = await Promise.all([
    db.from('courses').select('course_id').eq('project_id', projectId),
    db.from('training_locations').select('name').eq('project_id', projectId).eq('active', true),
    db.from('project_roles').select('project_role_name').eq('project_id', projectId)
  ]);
  [courses, locations, roles].forEach((result) => {
    if (result.error) throw result.error;
  });

  const people = new Map();
  for (const part of chunk(ids, 200)) {
    const { data, error } = await db.from('end_users').select('id, name, project_id').in('id', part);
    if (error) throw error;
    (data || []).forEach((person) => people.set(person.id, person));
  }

  const current = new Map();
  const inProject = ids.filter((id) => people.get(id)?.project_id === projectId);
  for (const part of chunk(inProject, 100)) {
    const rows = await fetchAllRows(() => db.from('user_course_mappings').select('end_user_id, course_id').eq('project_id', projectId).in('end_user_id', part));
    rows.forEach((row) => {
      if (!current.has(row.end_user_id)) current.set(row.end_user_id, []);
      current.get(row.end_user_id).push(row.course_id);
    });
  }

  return {
    projectId,
    people,
    current,
    courses: (courses.data || []).map((row) => row.course_id),
    locations: (locations.data || []).map((row) => row.name),
    roles: (roles.data || []).map((row) => row.project_role_name)
  };
}

/** Per person: create if new, add courses, then (only if that worked) remove courses. */
export function applyAssignmentsImport(items, { db, projectId }, onProgress) {
  return runOps(
    items,
    async (op) => {
      if (op.create) {
        const created = await db.from('end_users').insert([op.create]);
        if (created.error) throw new Error(explainDatabaseError(created.error));
      }
      if (op.add.length > 0) {
        const now = new Date().toISOString();
        const inserted = await db
          .from('user_course_mappings')
          .insert(op.add.map((courseId) => ({ project_id: projectId, end_user_id: op.id, course_id: courseId, assigned_by: 'bulk', assigned_date: now })));
        if (inserted.error) throw new Error(explainDatabaseError(inserted.error));
      }
      if (op.remove.length > 0) {
        const removed = await db.from('user_course_mappings').delete().eq('project_id', projectId).eq('end_user_id', op.id).in('course_id', op.remove);
        if (removed.error) throw new Error(explainDatabaseError(removed.error));
      }
    },
    onProgress
  );
}
