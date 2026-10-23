// Checking an MS Access training data export before it replaces a project's training data. Pure: no database.
//
// The file is one flat table: one row per person per course. Required: ID (course), functional_area,
// sub_functional_area (the course name), est_duration_hrs, emp_id, name, and a training_location or location.
import { matchColumns, rowToRecord } from './tableFile';

export const ACCESS_COLUMNS = [
  'id', 'functional_area', 'sub_functional_area', 'est_duration_hrs', 'emp_id', 'name', 'business_unit', 'org', 'country',
  'department', 'job_title', 'email', 'location', 'training_location', 'project_role', 'assigned_by', 'assigned_date', 'notes'
];

// How the file's column names are shown to people
const REQUIRED = [
  ['id', 'ID'], ['functional_area', 'functional_area'], ['sub_functional_area', 'sub_functional_area'],
  ['est_duration_hrs', 'est_duration_hrs'], ['emp_id', 'emp_id'], ['name', 'name']
];

const text = (value) => (value ?? '').trim();

/** One file row -> the problem with it, or null. Same rules as the old import. */
function problemWith(record) {
  if (!text(record.emp_id) || !text(record.name)) return 'emp_id and name are required';
  if (!text(record.training_location) && !text(record.location)) return 'Either training_location or location must be provided';
  if (!text(record.id) || !text(record.sub_functional_area) || !text(record.est_duration_hrs)) return 'ID, sub_functional_area, and est_duration_hrs are required';
  if (!text(record.functional_area)) return 'functional_area is required';
  const duration = parseFloat(record.est_duration_hrs);
  if (Number.isNaN(duration) || duration <= 0) return `Invalid est_duration_hrs: ${record.est_duration_hrs}`;
  return null;
}

/**
 * Check an Access export.
 * @returns {{ fileProblems: string[], ignoredColumns: string[], rows: Array, errors: Array<{rowNumber, name, message}>,
 *   summary: { rows, people, courses, locations, areas, duplicates } }}
 *   `rows` are the valid file rows (as records); `summary` describes them.
 */
export function planAccessImport(table) {
  const { columns, ignored } = matchColumns(table.headers, ACCESS_COLUMNS);
  const have = new Set(Object.values(columns));
  const empty = { rows: 0, people: 0, courses: 0, locations: 0, areas: 0, duplicates: 0 };

  const missing = REQUIRED.filter(([key]) => !have.has(key)).map(([, label]) => label);
  const fileProblems = [];
  if (missing.length > 0) fileProblems.push(`Missing required columns: ${missing.join(', ')}. Expected the Access export columns: ID, functional_area, sub_functional_area, est_duration_hrs, emp_id, name, and so on.`);
  if (!have.has('training_location') && !have.has('location')) fileProblems.push('The file must include either a "training_location" or a "location" column.');
  if (fileProblems.length > 0) return { fileProblems, ignoredColumns: ignored, rows: [], errors: [], summary: empty };

  const rows = [];
  const errors = [];
  table.rows.forEach((row) => {
    const record = rowToRecord(row, columns);
    const message = problemWith(record);
    if (message) errors.push({ rowNumber: row.rowNumber, name: text(record.name) || `Row ${row.rowNumber}`, message });
    else rows.push({ rowNumber: row.rowNumber, ...record });
  });

  const seen = new Set();
  let duplicates = 0;
  rows.forEach((record) => {
    const key = `${text(record.emp_id)}|${text(record.id)}`;
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  });

  const distinct = (pick) => new Set(rows.map(pick)).size;
  return {
    fileProblems,
    ignoredColumns: ignored,
    rows,
    errors,
    summary: {
      rows: rows.length,
      people: distinct((r) => text(r.emp_id)),
      courses: distinct((r) => text(r.id)),
      locations: distinct((r) => text(r.training_location) || text(r.location) || 'Unknown Location'),
      areas: distinct((r) => text(r.functional_area)),
      duplicates
    }
  };
}

/** A valid file row as a training_data row (the Access names become the database names). */
export function toTrainingDataRow(record, projectId, now = new Date()) {
  const or = (value) => text(value) || null;
  return {
    project_id: projectId,
    user_id: text(record.emp_id),
    user_name: text(record.name),
    user_email: or(record.email),
    business_unit: or(record.business_unit),
    organization: or(record.org),
    user_country: or(record.country),
    user_department: or(record.department),
    user_job_title: or(record.job_title),
    user_location: or(record.location),
    training_location: text(record.training_location) || text(record.location) || 'Unknown Location',
    user_project_role: or(record.project_role),
    course_id: String(text(record.id)),
    course_name: text(record.sub_functional_area),
    duration_hrs: parseFloat(record.est_duration_hrs),
    course_topic: null,
    course_sub_topic: null,
    course_application: null,
    course_priority: 1,
    functional_area: text(record.functional_area),
    sub_functional_area: text(record.sub_functional_area),
    functional_area_short: null,
    assigned_by: text(record.assigned_by) || 'import',
    assigned_date: text(record.assigned_date) || now.toISOString(),
    assignment_notes: or(record.notes)
  };
}

/** The columns of the export file (the same names the database uses). */
export const TRAINING_DATA_EXPORT_HEADERS = [
  'user_id', 'user_name', 'user_email', 'business_unit', 'organization', 'user_country', 'user_department', 'user_job_title',
  'user_location', 'training_location', 'user_project_role', 'course_id', 'course_name', 'duration_hrs', 'course_topic',
  'course_sub_topic', 'course_application', 'course_priority', 'functional_area', 'sub_functional_area', 'functional_area_short',
  'assigned_by', 'assigned_date', 'assignment_notes'
];

/** Rows in a stable order (location, person, course) for the export file. */
export function trainingDataToRows(data) {
  return [...data]
    .sort((a, b) => String(a.training_location).localeCompare(String(b.training_location)) || String(a.user_name).localeCompare(String(b.user_name)) || String(a.course_id).localeCompare(String(b.course_id), undefined, { numeric: true }))
    .map((row) => TRAINING_DATA_EXPORT_HEADERS.map((header) => (row[header] === null || row[header] === undefined ? '' : row[header])));
}
