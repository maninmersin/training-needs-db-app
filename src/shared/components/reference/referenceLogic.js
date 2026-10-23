// Pure rules for the Reference Data screen: search, drafts, validation, and what gets saved. No React, no database.

const textOf = (value) => (value === null || value === undefined ? '' : String(value));

export const editableColumns = (tab) => tab.columns.filter((column) => !column.readonly);

/** Search over every column of the list, ignoring case. */
export function filterItems(tab, items, searchTerm) {
  const needle = searchTerm.toLowerCase();
  if (!needle) return items;
  return items.filter((item) => tab.columns.some((column) => textOf(item[column.key]).toLowerCase().includes(needle)));
}

/** A blank form: text empty, "Active" on, and the usual defaults for order, capacity and classrooms. */
export function blankDraft(tab) {
  const draft = {};
  editableColumns(tab).forEach((column) => {
    if (column.type === 'boolean') draft[column.key] = true;
    else if (column.type === 'number') draft[column.key] = textOf(column.default ?? '');
    else draft[column.key] = '';
  });
  return draft;
}

/** The saved item as form values (numbers as text so the boxes can be cleared). */
export function itemToDraft(tab, item) {
  const draft = {};
  editableColumns(tab).forEach((column) => {
    draft[column.key] = column.type === 'boolean' ? Boolean(item[column.key]) : textOf(item[column.key]);
  });
  return draft;
}

/** { field: message } for a draft; empty means valid. Numbers may be blank but must be whole and not negative. */
export function validateDraft(tab, draft) {
  const errors = {};
  if (!textOf(draft[tab.displayField]).trim()) errors[tab.displayField] = `${tab.nameLabel} is required`;
  editableColumns(tab).forEach((column) => {
    if (column.type !== 'number') return;
    const text = textOf(draft[column.key]).trim();
    if (text === '') return;
    const value = Number(text);
    if (!Number.isInteger(value) || value < 0) errors[column.key] = 'Enter a whole number (0 or more)';
  });
  return errors;
}

/** Form text to saved values: blank numbers become null (0 stays 0). */
export function draftToValues(tab, draft) {
  const values = {};
  editableColumns(tab).forEach((column) => {
    const raw = draft[column.key];
    if (column.type === 'number') values[column.key] = textOf(raw).trim() === '' ? null : Number(raw);
    else values[column.key] = column.type === 'boolean' ? Boolean(raw) : raw;
  });
  return values;
}

/** Only the fields whose saved value differs from the item. */
export function changedValues(tab, item, draft) {
  const next = draftToValues(tab, draft);
  const changes = {};
  Object.entries(next).forEach(([key, value]) => {
    if (textOf(value) !== textOf(item[key])) changes[key] = value;
  });
  return changes;
}
