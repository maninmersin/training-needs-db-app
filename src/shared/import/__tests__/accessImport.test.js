import { tableFromRows } from '../tableFile';
import { planAccessImport, toTrainingDataRow, trainingDataToRows, TRAINING_DATA_EXPORT_HEADERS } from '../accessImport';

const HEADERS = ['ID', 'functional_area', 'sub_functional_area', 'est_duration_hrs', 'emp_id', 'name', 'business-unit', 'org', 'country', 'department', 'job_title', 'email', 'location', 'training_location', 'project_role', 'assigned_by', 'assigned_date', 'notes'];
const row = (over = {}) => {
  const base = { ID: '24', functional_area: 'Finance', sub_functional_area: 'Ledger Basics', est_duration_hrs: '3', emp_id: '1001', name: 'Amelia Brown', 'business-unit': 'Finance', org: 'ACME', country: 'UK', department: 'Accounts', job_title: 'Analyst', email: 'a@x.com', location: 'London HQ', training_location: 'London', project_role: 'Buyer', assigned_by: '', assigned_date: '', notes: '', ...over };
  return HEADERS.map((header) => base[header]);
};
const table = (...rows) => tableFromRows([HEADERS, ...rows]);

describe('planAccessImport', () => {
  test('a good file has no problems and is described by its numbers', () => {
    const plan = planAccessImport(table(row(), row({ emp_id: '1002', name: 'Oliver' }), row({ ID: '25', functional_area: 'HR', training_location: 'Leeds' })));
    expect(plan.fileProblems).toEqual([]);
    expect(plan.errors).toEqual([]);
    expect(plan.summary).toEqual({ rows: 3, people: 2, courses: 2, locations: 2, areas: 2, duplicates: 0 });
  });

  test('missing required columns are named, and nothing is read', () => {
    const plan = planAccessImport(tableFromRows([['emp_id', 'name', 'training_location'], ['1', 'A', 'London']]));
    expect(plan.fileProblems[0]).toMatch(/Missing required columns: ID, functional_area, sub_functional_area, est_duration_hrs/);
    expect(plan.rows).toEqual([]);
  });

  test('either training_location or location must exist as a column', () => {
    const noLocation = tableFromRows([['ID', 'functional_area', 'sub_functional_area', 'est_duration_hrs', 'emp_id', 'name'], ['1', 'F', 'C', '1', '9', 'A']]);
    expect(planAccessImport(noLocation).fileProblems).toEqual(['The file must include either a "training_location" or a "location" column.']);
    const onlyLocation = tableFromRows([['ID', 'functional_area', 'sub_functional_area', 'est_duration_hrs', 'emp_id', 'name', 'location'], ['1', 'F', 'C', '1', '9', 'A', 'Leeds']]);
    expect(planAccessImport(onlyLocation).fileProblems).toEqual([]);
  });

  test('column names match however they are capitalised or punctuated', () => {
    const plan = planAccessImport(tableFromRows([['id', 'Functional Area', 'Sub-Functional-Area', 'EST_DURATION_HRS', 'Emp ID', 'Name', 'Training Location'], ['1', 'F', 'C', '2', '9', 'A', 'London']]));
    expect(plan.fileProblems).toEqual([]);
    expect(plan.summary.rows).toBe(1);
  });

  test('each rule gives the same message the old import gave, with the row number and name', () => {
    const plan = planAccessImport(table(
      row({ emp_id: '' }),
      row({ training_location: '', location: '' }),
      row({ sub_functional_area: '' }),
      row({ functional_area: '' }),
      row({ est_duration_hrs: 'abc' }),
      row({ est_duration_hrs: '0' }),
      row()
    ));
    expect(plan.errors.map((e) => [e.rowNumber, e.message])).toEqual([
      [2, 'emp_id and name are required'],
      [3, 'Either training_location or location must be provided'],
      [4, 'ID, sub_functional_area, and est_duration_hrs are required'],
      [5, 'functional_area is required'],
      [6, 'Invalid est_duration_hrs: abc'],
      [7, 'Invalid est_duration_hrs: 0']
    ]);
    expect(plan.rows).toHaveLength(1);
    expect(plan.errors[0].name).toBe('Amelia Brown');
  });

  test('the same person on the same course twice is counted as a duplicate but still read', () => {
    const plan = planAccessImport(table(row(), row()));
    expect(plan.summary.duplicates).toBe(1);
    expect(plan.summary.rows).toBe(2);
  });

  test('a row with a location but no training_location uses the location', () => {
    const plan = planAccessImport(table(row({ training_location: '', location: 'Leeds' })));
    expect(plan.summary.locations).toBe(1);
    expect(toTrainingDataRow(plan.rows[0], 'p1').training_location).toBe('Leeds');
  });

  test('unrecognised columns are listed as ignored', () => {
    const plan = planAccessImport(tableFromRows([[...HEADERS, 'Shoe size'], [...row(), '9']]));
    expect(plan.ignoredColumns).toEqual(['Shoe size']);
  });

  test('a file with no rows is valid but has nothing to import', () => {
    expect(planAccessImport(table()).summary.rows).toBe(0);
  });
});

describe('toTrainingDataRow', () => {
  const NOW = new Date('2026-10-23T09:00:00Z');
  const record = () => planAccessImport(table(row())).rows[0];

  test('Access names become the database names, for this project', () => {
    expect(toTrainingDataRow(record(), 'p1', NOW)).toEqual({
      project_id: 'p1', user_id: '1001', user_name: 'Amelia Brown', user_email: 'a@x.com', business_unit: 'Finance', organization: 'ACME',
      user_country: 'UK', user_department: 'Accounts', user_job_title: 'Analyst', user_location: 'London HQ', training_location: 'London',
      user_project_role: 'Buyer', course_id: '24', course_name: 'Ledger Basics', duration_hrs: 3, course_topic: null, course_sub_topic: null,
      course_application: null, course_priority: 1, functional_area: 'Finance', sub_functional_area: 'Ledger Basics', functional_area_short: null,
      assigned_by: 'import', assigned_date: NOW.toISOString(), assignment_notes: null
    });
  });

  test('blank optional values become null, and given values are kept', () => {
    const mapped = toTrainingDataRow(planAccessImport(table(row({ email: '', org: '', assigned_by: 'Stuart', assigned_date: '2026-01-05', notes: 'Rush' }))).rows[0], 'p1', NOW);
    expect(mapped).toMatchObject({ user_email: null, organization: null, assigned_by: 'Stuart', assigned_date: '2026-01-05', assignment_notes: 'Rush' });
  });

  test('a decimal duration is kept', () => {
    expect(toTrainingDataRow(planAccessImport(table(row({ est_duration_hrs: '1.5' }))).rows[0], 'p1').duration_hrs).toBe(1.5);
  });
});

describe('export rows', () => {
  test('are in a stable order (location, person, course) with numbers in course order and blanks empty', () => {
    const data = [
      { training_location: 'London', user_name: 'Zed', course_id: '2', user_email: null },
      { training_location: 'Leeds', user_name: 'Ann', course_id: '10' },
      { training_location: 'Leeds', user_name: 'Ann', course_id: '9' }
    ];
    const rows = trainingDataToRows(data);
    const at = (name) => TRAINING_DATA_EXPORT_HEADERS.indexOf(name);
    expect(rows.map((r) => [r[at('training_location')], r[at('user_name')], r[at('course_id')]])).toEqual([['Leeds', 'Ann', '9'], ['Leeds', 'Ann', '10'], ['London', 'Zed', '2']]);
    expect(rows[2][at('user_email')]).toBe('');
    expect(rows[0]).toHaveLength(TRAINING_DATA_EXPORT_HEADERS.length);
  });
});
