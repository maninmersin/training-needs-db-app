// Importing people (end users) from a spreadsheet: check it against the current data, then apply.
// Rules: change_type Add / Update / Delete (blank = Add, which updates the person if the ID exists);
// a blank cell leaves a stored value alone, "[clear]" empties it; deletes need "Allow deletes".
import { matchColumns, rowToRecord } from './tableFile';
import { STATUS, canonicalMatch, countByStatus, explainDatabaseError, isClear, runOps } from './planning';

export const PEOPLE_FIELDS = ['name', 'email', 'job_title', 'country', 'division', 'sub_division', 'location_name', 'training_location', 'project_role'];
export const PEOPLE_COLUMNS = ['change_type', 'id', ...PEOPLE_FIELDS];
const ALIASES = { jobtitle: 'job_title', subdivision: 'sub_division', locationname: 'location_name', userid: 'id', user_id: 'id', employee_id: 'id', role: 'project_role' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const label = (field) => field.replace(/_/g, ' ');
const sameText = (a, b) => Boolean(b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

const chunk = (list, size) => {
  const parts = [];
  for (let i = 0; i < list.length; i += size) parts.push(list.slice(i, i + size));
  return parts;
};

/** The IDs mentioned in the file (so only those people need loading to check against). */
export function peopleIdsInFile(table) {
  const { columns } = matchColumns(table.headers, PEOPLE_COLUMNS, ALIASES);
  const idHeader = Object.keys(columns).find((header) => columns[header] === 'id');
  if (!idHeader) return [];
  return table.rows.map((row) => row.values[idHeader]).filter((value) => /^\d+$/.test(value)).map(Number);
}

/**
 * Check a people file. `ctx` = { projectId, existing: Map(id -> person, from any project), locations: [names], roles: [names] }.
 * Returns { fileProblems, ignoredColumns, items, tiles }. Each item = { rowNumber, label, action, status, message, op }.
 */
export function planPeopleImport(table, ctx, { allowDeletes = false } = {}) {
  const { columns, ignored } = matchColumns(table.headers, PEOPLE_COLUMNS, ALIASES);
  const have = new Set(Object.values(columns));
  const ignoredColumns = ignored;

  if (!have.has('id')) {
    return { fileProblems: ['The file needs an "id" column (one row per person).'], ignoredColumns, items: [], tiles: [] };
  }

  const seen = new Map();
  const items = table.rows.map((row) => {
    const record = rowToRecord(row, columns);
    const rawId = (record.id ?? '').trim();
    const base = { rowNumber: row.rowNumber, label: record.name?.trim() || (rawId ? `ID ${rawId}` : `Row ${row.rowNumber}`) };
    const error = (message) => ({ ...base, action: '', status: STATUS.ERROR, message, op: null });

    const typeText = (record.change_type ?? '').trim();
    const type = typeText === '' ? 'add' : typeText.toLowerCase();
    if (!['add', 'update', 'delete'].includes(type)) return error(`Unknown change type "${typeText}" (use Add, Update or Delete)`);
    if (rawId === '') return error('ID is required');
    if (!/^\d+$/.test(rawId)) return error('ID must be a whole number');
    const id = Number(rawId);
    if (seen.has(id)) return error(`Same ID as row ${seen.get(id)}`);
    seen.set(id, row.rowNumber);

    const existing = ctx.existing.get(id);
    if (existing && existing.project_id !== ctx.projectId) return error(`ID ${id} belongs to a person in another project`);

    if (type === 'delete') {
      if (!existing) return error(`No person with ID ${id} in this project`);
      const item = { ...base, label: existing.name || base.label, action: 'Delete' };
      return allowDeletes
        ? { ...item, status: STATUS.OK, message: 'Will be deleted (and removed from any sessions)', op: { type: 'delete', id } }
        : { ...item, status: STATUS.BLOCKED, message: 'Held back: tick "Allow deletes" to remove this person', op: null };
    }

    if (type === 'update' && !existing) return error(`No person with ID ${id} in this project`);

    // What the file asks for, field by field. undefined = leave alone, null = empty it.
    const wanted = {};
    const problems = [];
    const warnings = [];
    PEOPLE_FIELDS.forEach((field) => {
      if (!have.has(field)) return;
      const raw = (record[field] ?? '').trim();
      if (isClear(raw)) {
        if (field === 'name' || field === 'email') problems.push(`${label(field)} cannot be cleared`);
        else wanted[field] = null;
      } else if (raw !== '') {
        wanted[field] = raw;
      }
    });

    if (wanted.email && !EMAIL.test(wanted.email)) problems.push('Enter a full email address');
    // A value the person already has is not checked again: exporting, editing and importing back must always work,
    // even if a location was switched off since. Only a changed value has to be on the Reference Data lists.
    if (wanted.training_location) {
      if (sameText(wanted.training_location, existing?.training_location)) {
        wanted.training_location = existing.training_location;
      } else {
        const match = canonicalMatch(wanted.training_location, ctx.locations);
        if (match) wanted.training_location = match;
        else if (canonicalMatch(wanted.training_location, ctx.inactiveLocations || [])) problems.push(`Training location "${wanted.training_location}" is switched off (inactive) in Reference Data`);
        else problems.push(`Training location "${wanted.training_location}" is not in Reference Data (add it there first)`);
      }
    }
    if (wanted.project_role) {
      if (sameText(wanted.project_role, existing?.project_role)) {
        wanted.project_role = existing.project_role;
      } else {
        const match = canonicalMatch(wanted.project_role, ctx.roles);
        if (match) wanted.project_role = match;
        else warnings.push(`Role "${wanted.project_role}" is not in Reference Data`);
      }
    }
    if (!existing && (!wanted.name || !wanted.email)) problems.push('Name and email are required for a new person');
    if (problems.length > 0) return error(problems.join('; '));

    const status = warnings.length > 0 ? STATUS.WARNING : STATUS.OK;
    const note = warnings.length > 0 ? ` (${warnings.join('; ')})` : '';

    if (!existing) {
      return { ...base, action: 'Add', status, message: `New person${note}`, op: { type: 'add', row: { id, project_id: ctx.projectId, ...wanted } } };
    }

    const changes = {};
    Object.entries(wanted).forEach(([field, value]) => {
      if (String(value ?? '') !== String(existing[field] ?? '')) changes[field] = value;
    });
    if (Object.keys(changes).length === 0) return { ...base, label: existing.name || base.label, action: 'Update', status: STATUS.UNCHANGED, message: 'No changes', op: null };

    const prefix = type === 'add' ? 'Already exists - will update' : 'Will update';
    return {
      ...base,
      label: existing.name || base.label,
      action: 'Update',
      status,
      message: `${prefix}: ${Object.keys(changes).map(label).join(', ')}${note}`,
      op: { type: 'update', id, values: changes }
    };
  });

  const applies = (item) => item.op && item.status !== STATUS.ERROR;
  const tiles = [
    { label: 'New people to add', value: items.filter((i) => applies(i) && i.action === 'Add').length },
    { label: 'Existing people updated', value: items.filter((i) => applies(i) && i.action === 'Update').length, tone: 'success' },
    { label: 'People deleted', value: items.filter((i) => applies(i) && i.action === 'Delete').length, tone: 'danger' },
    { label: 'Held back', value: countByStatus(items).blocked, tone: 'warning' },
    { label: 'Need a look (still imported)', value: countByStatus(items).warning, tone: 'warning' },
    { label: 'Cannot be imported', value: countByStatus(items).error, tone: 'danger' },
    { label: 'No change', value: countByStatus(items).unchanged }
  ].filter((tile, index) => index < 3 || tile.value > 0);

  return { fileProblems: [], ignoredColumns, items, tiles };
}

/** Read what the check needs from the database. */
export async function loadPeopleContext(db, projectId, table) {
  const [locations, roles] = await Promise.all([
    db.from('training_locations').select('name, active').eq('project_id', projectId),
    db.from('project_roles').select('project_role_name').eq('project_id', projectId)
  ]);
  if (locations.error) throw locations.error;
  if (roles.error) throw roles.error;

  const existing = new Map();
  for (const ids of chunk(peopleIdsInFile(table), 200)) {
    const { data, error } = await db.from('end_users').select('*').in('id', ids);
    if (error) throw error;
    (data || []).forEach((person) => existing.set(person.id, person));
  }
  return {
    projectId,
    existing,
    locations: (locations.data || []).filter((row) => row.active !== false).map((row) => row.name),
    inactiveLocations: (locations.data || []).filter((row) => row.active === false).map((row) => row.name),
    roles: (roles.data || []).map((row) => row.project_role_name)
  };
}

/** Write the changes. One person at a time, so one failure never stops the rest. */
export function applyPeopleImport(items, { db, projectId }, onProgress) {
  return runOps(
    items,
    async (op) => {
      let result;
      if (op.type === 'add') {
        result = await db.from('end_users').insert([op.row]).select('id');
      } else if (op.type === 'update') {
        result = await db.from('end_users').update(op.values).eq('id', op.id).eq('project_id', projectId).select('id');
      } else {
        result = await db.from('end_users').delete().eq('id', op.id).eq('project_id', projectId).select('id');
      }
      if (result.error) throw new Error(explainDatabaseError(result.error));
      if (op.type !== 'add' && (!result.data || result.data.length === 0)) throw new Error('This person no longer exists in the project');
    },
    onProgress
  );
}
