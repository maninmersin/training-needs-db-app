// Grouping attendance records for the Reports overview. Pure: no database.

/** What the statistics look like when there is no attendance at all (same shape as when there is some). */
export const EMPTY_STATISTICS = {
  overall: { total_records: 0, total_present: 0, total_absent: 0, attendance_rate: 0 },
  by_functional_area: {},
  by_training_location: {},
  by_course: {}
};

/**
 * Count attendance records by a key, for example the session's functional area, location or course.
 * @param {Array} rows - records with `attendance_statuses.is_present`
 * @param {(row) => string} keyOf - the group a record belongs to; an empty value is grouped as "Not set"
 * @returns {Object} { [key]: { total, present, attendance_rate } }, keys in alphabetical order
 */
export function groupAttendance(rows, keyOf) {
  const groups = {};
  rows.forEach((row) => {
    const key = String(keyOf(row) ?? '').trim() || 'Not set';
    if (!groups[key]) groups[key] = { total: 0, present: 0 };
    groups[key].total += 1;
    if (row.attendance_statuses.is_present) groups[key].present += 1;
  });
  return Object.fromEntries(
    Object.keys(groups)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((key) => [key, { ...groups[key], attendance_rate: groups[key].total > 0 ? (groups[key].present / groups[key].total) * 100 : 0 }])
  );
}
