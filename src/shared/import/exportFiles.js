// What the Export and Template buttons produce. The row builders are pure; downloadTable saves the file.
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { fetchAllRows } from '@core/utils/fetchAllRows';
import { toCsv } from './csv';
import { PEOPLE_COLUMNS, PEOPLE_FIELDS } from './peopleImport';
import { COURSE_COLUMNS } from './coursesImport';

export const PEOPLE_EXPORT_HEADERS = ['id', ...PEOPLE_FIELDS];
export const COURSE_EXPORT_HEADERS = COURSE_COLUMNS.filter((name) => name !== 'change_type');
export const ASSIGNMENT_HEADERS = ['UserID', 'Name', 'Email', 'Role', 'Location', 'CourseID'];

const cell = (value) => (value === null || value === undefined ? '' : value);

export const peopleToRows = (people) => people.map((person) => PEOPLE_EXPORT_HEADERS.map((header) => cell(person[header])));
export const coursesToRows = (courses) => courses.map((course) => COURSE_EXPORT_HEADERS.map((header) => cell(course[header])));

/** One row per person per course, people in ID order then courses in order. Mappings for unknown people are skipped. */
export function assignmentsToRows(mappings, people) {
  const byId = new Map(people.map((person) => [person.id, person]));
  return [...mappings]
    .filter((mapping) => byId.has(mapping.end_user_id))
    .sort((a, b) => a.end_user_id - b.end_user_id || String(a.course_id).localeCompare(String(b.course_id), undefined, { numeric: true }))
    .map((mapping) => {
      const person = byId.get(mapping.end_user_id);
      return [person.id, person.name, person.email, cell(person.project_role), cell(person.training_location), mapping.course_id];
    });
}

/** Every assignment in the project as export rows. Looks people up separately (no embedding), paging past 1000 rows. */
export async function loadAssignmentRows(db, projectId) {
  const [mappings, people] = await Promise.all([
    fetchAllRows(() => db.from('user_course_mappings').select('end_user_id, course_id').eq('project_id', projectId)),
    fetchAllRows(() => db.from('end_users').select('id, name, email, project_role, training_location').eq('project_id', projectId))
  ]);
  return assignmentsToRows(mappings, people);
}

/** Sample files shown to people who are starting from scratch. */
export const TEMPLATES = {
  people: {
    filename: 'end_users_template',
    headers: PEOPLE_COLUMNS,
    rows: [
      ['Add', 1, 'John Doe', 'john@example.com', 'Product Manager', 'Egypt', 'Distribution', 'Logistics', 'Cairo Office', 'Cairo', 'Logistics Planner'],
      ['Update', 2, '', '', '[clear]', '', '', '', '', '', '']
    ]
  },
  courses: {
    filename: 'courses_template',
    headers: COURSE_COLUMNS,
    rows: [
      ['Add', 'FIN-101', 'Ledger Basics', 'Finance', 3, 'ERP', 1],
      ['Update', 'FIN-102', '', '', 4, '', '']
    ]
  },
  assignments: {
    filename: 'user_course_mappings_template',
    headers: ASSIGNMENT_HEADERS,
    rows: [
      [1, 'John Doe', 'john@example.com', 'Manager', 'London', 'FIN-101'],
      [1, 'John Doe', 'john@example.com', 'Manager', 'London', 'FIN-102'],
      [2, 'Mary Smith', 'mary@example.com', 'Staff', 'Cairo', 'FIN-101']
    ]
  }
};

/** Save headers + rows as an Excel (.xlsx) or CSV file. `name` has no extension. */
export function downloadTable(name, headers, rows, format = 'xlsx') {
  if (format === 'csv') {
    saveAs(new Blob([toCsv([headers, ...rows])], { type: 'text/csv;charset=utf-8' }), `${name}.csv`);
    return;
  }
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet['!cols'] = headers.map((header, index) => ({ wch: Math.min(40, Math.max(10, header.length, ...rows.map((row) => String(row[index] ?? '').length))) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data');
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  saveAs(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${name}.xlsx`);
}

export const downloadTemplate = (key, format = 'xlsx') => {
  const template = TEMPLATES[key];
  downloadTable(template.filename, template.headers, template.rows, format);
};

/** CSV problem report: every row that needs attention (and what was done, after an apply). */
export function reportRows(items, outcomes = []) {
  const outcomeOf = new Map(outcomes.map((outcome) => [outcome.item, outcome]));
  return items.map((item) => {
    const outcome = outcomeOf.get(item);
    return [item.rowNumber, item.label, item.action, outcome ? (outcome.ok ? 'Applied' : 'Failed') : item.status, outcome && !outcome.ok ? outcome.message : item.message];
  });
}
export const REPORT_HEADERS = ['Row', 'Name', 'Action', 'Result', 'Detail'];
