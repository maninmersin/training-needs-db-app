// Importing courses from a spreadsheet: check it against the current data, then apply.
// Same rules as people: change_type Add / Update / Delete (blank = Add, which updates if the course exists),
// blank cell = leave alone, "[clear]" empties an optional field, deletes need "Allow deletes".
import { matchColumns, rowToRecord } from './tableFile';
import { STATUS, canonicalMatch, countByStatus, explainDatabaseError, isClear, runOps } from './planning';

export const COURSE_FIELDS = ['course_name', 'functional_area', 'duration_hrs', 'application', 'priority'];
export const COURSE_COLUMNS = ['change_type', 'course_id', ...COURSE_FIELDS];
const ALIASES = { courseid: 'course_id', duration: 'duration_hrs', hours: 'duration_hrs', area: 'functional_area', name: 'course_name' };
const label = (field) => field.replace(/_/g, ' ');

const chunk = (list, size) => {
  const parts = [];
  for (let i = 0; i < list.length; i += size) parts.push(list.slice(i, i + size));
  return parts;
};

export function courseIdsInFile(table) {
  const { columns } = matchColumns(table.headers, COURSE_COLUMNS, ALIASES);
  const header = Object.keys(columns).find((name) => columns[name] === 'course_id');
  return header ? table.rows.map((row) => row.values[header]).filter(Boolean) : [];
}

/**
 * Check a courses file. `ctx` = { projectId, existing: Map(course_id -> course, from any project), areas: [names] }.
 * Returns { fileProblems, ignoredColumns, items, tiles }.
 */
export function planCoursesImport(table, ctx, { allowDeletes = false } = {}) {
  const { columns, ignored } = matchColumns(table.headers, COURSE_COLUMNS, ALIASES);
  const have = new Set(Object.values(columns));

  if (!have.has('course_id')) {
    return { fileProblems: ['The file needs a "course_id" column (one row per course).'], ignoredColumns: ignored, items: [], tiles: [] };
  }

  const seen = new Map();
  const items = table.rows.map((row) => {
    const record = rowToRecord(row, columns);
    const courseId = (record.course_id ?? '').trim();
    const base = { rowNumber: row.rowNumber, label: courseId || `Row ${row.rowNumber}` };
    const error = (message) => ({ ...base, action: '', status: STATUS.ERROR, message, op: null });

    const typeText = (record.change_type ?? '').trim();
    const type = typeText === '' ? 'add' : typeText.toLowerCase();
    if (!['add', 'update', 'delete'].includes(type)) return error(`Unknown change type "${typeText}" (use Add, Update or Delete)`);
    if (courseId === '') return error('course_id is required');
    if (seen.has(courseId)) return error(`Same course ID as row ${seen.get(courseId)}`);
    seen.set(courseId, row.rowNumber);

    const existing = ctx.existing.get(courseId);
    if (existing && existing.project_id !== ctx.projectId) return error(`Course ID ${courseId} belongs to another project`);

    if (type === 'delete') {
      if (!existing) return error(`No course ${courseId} in this project`);
      const item = { ...base, action: 'Delete' };
      return allowDeletes
        ? { ...item, status: STATUS.OK, message: 'Will be deleted (individual course assignments for it are removed too)', op: { type: 'delete', courseId } }
        : { ...item, status: STATUS.BLOCKED, message: 'Held back: tick "Allow deletes" to remove this course', op: null };
    }

    if (type === 'update' && !existing) return error(`No course ${courseId} in this project`);

    const wanted = {};
    const problems = [];
    COURSE_FIELDS.forEach((field) => {
      if (!have.has(field)) return;
      const raw = (record[field] ?? '').trim();
      if (isClear(raw)) {
        if (field === 'application' || field === 'course_name') wanted[field] = null;
        else problems.push(`${label(field)} cannot be cleared`);
      } else if (raw !== '') {
        wanted[field] = raw;
      }
    });

    if (wanted.duration_hrs !== undefined) {
      const hours = Number(wanted.duration_hrs);
      if (Number.isNaN(hours) || hours < 0) problems.push('Duration (hrs) must be a number, 0 or more');
      else wanted.duration_hrs = hours;
    }
    if (wanted.priority !== undefined) {
      const priority = Number(wanted.priority);
      if (!Number.isInteger(priority) || priority < 1) problems.push('Priority must be a whole number, 1 or more (1 = highest)');
      else wanted.priority = priority;
    }
    if (wanted.functional_area) {
      const match = canonicalMatch(wanted.functional_area, ctx.areas);
      if (match) wanted.functional_area = match;
      else problems.push(`Functional area "${wanted.functional_area}" is not in Reference Data (add it there first)`);
    }
    if (!existing) {
      const missing = ['course_name', 'functional_area', 'duration_hrs', 'priority'].filter((field) => wanted[field] === undefined || wanted[field] === null);
      if (missing.length > 0) problems.push(`A new course needs: ${missing.map(label).join(', ')}`);
    }
    if (problems.length > 0) return error(problems.join('; '));

    if (!existing) {
      return { ...base, action: 'Add', status: STATUS.OK, message: 'New course', op: { type: 'add', row: { course_id: courseId, project_id: ctx.projectId, ...wanted } } };
    }

    const changes = {};
    Object.entries(wanted).forEach(([field, value]) => {
      if (String(value ?? '') !== String(existing[field] ?? '')) changes[field] = value;
    });
    if (Object.keys(changes).length === 0) return { ...base, action: 'Update', status: STATUS.UNCHANGED, message: 'No changes', op: null };
    const prefix = type === 'add' ? 'Already exists - will update' : 'Will update';
    return { ...base, action: 'Update', status: STATUS.OK, message: `${prefix}: ${Object.keys(changes).map(label).join(', ')}`, op: { type: 'update', courseId, values: changes } };
  });

  const applies = (item) => item.op && item.status !== STATUS.ERROR;
  const counts = countByStatus(items);
  const tiles = [
    { label: 'New courses to add', value: items.filter((i) => applies(i) && i.action === 'Add').length },
    { label: 'Existing courses updated', value: items.filter((i) => applies(i) && i.action === 'Update').length, tone: 'success' },
    { label: 'Courses deleted', value: items.filter((i) => applies(i) && i.action === 'Delete').length, tone: 'danger' },
    { label: 'Held back', value: counts.blocked, tone: 'warning' },
    { label: 'Cannot be imported', value: counts.error, tone: 'danger' },
    { label: 'No change', value: counts.unchanged }
  ].filter((tile, index) => index < 3 || tile.value > 0);

  return { fileProblems: [], ignoredColumns: ignored, items, tiles };
}

export async function loadCoursesContext(db, projectId, table) {
  const areas = await db.from('functional_areas').select('name').eq('project_id', projectId).eq('active', true);
  if (areas.error) throw areas.error;

  const existing = new Map();
  for (const ids of chunk(courseIdsInFile(table), 100)) {
    const { data, error } = await db.from('courses').select('*').in('course_id', ids);
    if (error) throw error;
    (data || []).forEach((course) => existing.set(course.course_id, course));
  }
  return { projectId, existing, areas: (areas.data || []).map((row) => row.name) };
}

export function applyCoursesImport(items, { db, projectId }, onProgress) {
  return runOps(
    items,
    async (op) => {
      let result;
      if (op.type === 'add') {
        result = await db.from('courses').insert([op.row]).select('course_id');
      } else if (op.type === 'update') {
        result = await db.from('courses').update(op.values).eq('course_id', op.courseId).eq('project_id', projectId).select('course_id');
      } else {
        result = await db.from('courses').delete().eq('course_id', op.courseId).eq('project_id', projectId).select('course_id');
      }
      if (result.error) throw new Error(explainDatabaseError(result.error));
      if (op.type !== 'add' && (!result.data || result.data.length === 0)) throw new Error('This course no longer exists in the project');
    },
    onProgress
  );
}
