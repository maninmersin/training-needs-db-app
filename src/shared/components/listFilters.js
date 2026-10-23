// Search/filter rules shared by the list screens (End Users, Courses). Pure: no React, no database.

export const BLANK = '__BLANK__';
export const NOT_BLANK = '__NOT_BLANK__';

export const textOf = (value) => (value === null || value === undefined ? '' : String(value));

/** Applies the search box (over `fields`) and the per-column filters (any selected value matches). */
export function filterRows(rows, fields, searchTerm, columnFilters) {
  const needle = searchTerm.trim().toLowerCase();
  return rows.filter((row) => {
    if (needle && !fields.some((field) => textOf(row[field]).toLowerCase().includes(needle))) return false;

    return Object.entries(columnFilters).every(([field, selected]) => {
      if (!selected || selected.length === 0) return true;
      const value = textOf(row[field]);
      return selected.some((choice) => {
        if (choice === BLANK) return value.trim() === '';
        if (choice === NOT_BLANK) return value.trim() !== '';
        return value === choice;
      });
    });
  });
}

/** Sorted distinct non-blank values of a field, as text. */
export function uniqueColumnValues(rows, field) {
  const values = new Set();
  rows.forEach((row) => {
    const value = textOf(row[field]);
    if (value !== '') values.add(value);
  });
  return [...values].sort();
}

export const activeFilterCount = (columnFilters) =>
  Object.values(columnFilters).reduce((total, selected) => total + (selected ? selected.length : 0), 0);
