// Pure rules for the End Users screen: column order, filtering, edit/validate. No React, no database.

export const BLANK = '__BLANK__';
export const NOT_BLANK = '__NOT_BLANK__';

const SYSTEM_COLUMNS = ['project_id', 'created_at', 'updated_at'];
const COLUMN_ORDER = ['id', 'name', 'email', 'job_title', 'country', 'division', 'sub_division', 'location_name', 'training_location', 'project_role'];

/** Columns to show/edit: hides system columns, known columns first in a fixed order, the rest after (original order kept). */
export function orderColumns(schema) {
  const rank = (name) => {
    const index = COLUMN_ORDER.indexOf(name);
    return index === -1 ? COLUMN_ORDER.length : index;
  };
  return schema
    .filter((column) => !SYSTEM_COLUMNS.includes(column.column_name))
    .map((column, position) => ({ column, position }))
    .sort((a, b) => rank(a.column.column_name) - rank(b.column.column_name) || a.position - b.position)
    .map(({ column }) => column);
}

export const columnLabel = (name) => name.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const isRoleColumn = (name) => name === 'role' || name === 'project_role';
export const isIntegerColumn = (column) => column.data_type === 'integer';

const textOf = (value) => (value === null || value === undefined ? '' : String(value));

/** Applies the search box (any column) and the per-column filters (any selected value matches). */
export function filterUsers(users, columns, searchTerm, columnFilters) {
  const needle = searchTerm.trim().toLowerCase();
  return users.filter((user) => {
    if (needle && !columns.some((column) => textOf(user[column.column_name]).toLowerCase().includes(needle))) return false;

    return Object.entries(columnFilters).every(([columnName, selected]) => {
      if (!selected || selected.length === 0) return true;
      const value = textOf(user[columnName]);
      return selected.some((choice) => {
        if (choice === BLANK) return value.trim() === '';
        if (choice === NOT_BLANK) return value.trim() !== '';
        return value === choice;
      });
    });
  });
}

/** Sorted distinct non-blank values of a column, as text. */
export function uniqueColumnValues(users, columnName) {
  const values = new Set();
  users.forEach((user) => {
    const value = textOf(user[columnName]);
    if (value !== '') values.add(value);
  });
  return [...values].sort();
}

export const activeFilterCount = (columnFilters) =>
  Object.values(columnFilters).reduce((total, selected) => total + (selected ? selected.length : 0), 0);

/** Turns what was typed into what is saved: integer columns become numbers (blank = null). */
export function coerceValue(column, raw) {
  if (!isIntegerColumn(column)) return raw;
  if (raw === '' || raw === null || raw === undefined) return null;
  return Number(raw);
}

/** Only the fields whose value differs from the saved user (comparing as text, so 5 equals "5"). */
export function changedFields(user, draft, columns) {
  const changes = {};
  columns.forEach((column) => {
    const name = column.column_name;
    if (!(name in draft)) return;
    const next = coerceValue(column, draft[name]);
    if (textOf(next) !== textOf(user[name])) changes[name] = next;
  });
  return changes;
}

/** { field: message } for a draft; empty means valid. The ID is only checked when adding. */
export function validateDraft(draft, columns, { isNew }) {
  const errors = {};
  if (isNew && textOf(draft.id).trim() === '') errors.id = 'Employee ID is required';
  columns.forEach((column) => {
    const name = column.column_name;
    if (name === 'id' && !isNew) return;
    if (isIntegerColumn(column) && textOf(draft[name]).trim() !== '' && Number.isNaN(Number(draft[name]))) {
      errors[name] = 'Enter a whole number';
    }
  });
  return errors;
}

/** A blank form for a new person: every column empty, training location defaulting to the first one. */
export function blankDraft(columns, locations) {
  const draft = {};
  columns.forEach((column) => {
    draft[column.column_name] = column.column_name === 'training_location' ? locations[0]?.name || '' : '';
  });
  return draft;
}

/** The row to insert: typed values converted, blank integer fields left out. */
export function draftToRow(draft, columns) {
  const row = {};
  columns.forEach((column) => {
    const name = column.column_name;
    const value = coerceValue(column, draft[name]);
    if (value !== null || !isIntegerColumn(column)) row[name] = name === 'id' ? String(draft[name]).trim() : value;
  });
  return row;
}

const FIELD_GROUPS = [
  { title: 'Person', columns: ['id', 'name', 'email', 'job_title'] },
  { title: 'Where they work', columns: ['country', 'division', 'sub_division', 'location_name', 'training_location'] },
  { title: 'Training', columns: ['project_role', 'role'] }
];

/** Splits the columns into the sheet's sections; columns not listed go under "Other". */
export function groupColumns(columns) {
  const placed = new Set();
  const groups = FIELD_GROUPS.map((group) => {
    const members = group.columns.map((name) => columns.find((column) => column.column_name === name)).filter(Boolean);
    members.forEach((column) => placed.add(column.column_name));
    return { title: group.title, columns: members };
  });
  const other = columns.filter((column) => !placed.has(column.column_name));
  if (other.length > 0) groups.push({ title: 'Other', columns: other });
  return groups.filter((group) => group.columns.length > 0);
}
