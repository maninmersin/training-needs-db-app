// An in-memory stand-in for the database that behaves like the real API in the ways that matter here:
// it returns at most 1000 rows per request, and it records what was asked for.
let mockTables = {};
let mockRequests = [];
jest.mock('@core/services/supabaseClient', () => ({
  supabase: {
    from: (table) => {
      let rows = [...(mockTables[table] || [])];
      const request = { table, select: null, in: [] };
      mockRequests.push(request);
      const query = {
        select: (columns) => { request.select = columns; return query; },
        eq: (column, value) => { rows = rows.filter((r) => r[column] === value); return query; },
        in: (column, values) => { request.in.push({ column, count: values.length }); rows = rows.filter((r) => values.includes(r[column])); return query; },
        order: (column) => { rows = [...rows].sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0)); return query; },
        range: (from, to) => Promise.resolve({ data: rows.slice(from, Math.min(to, from + 999) + 1), error: null }),
        then: (resolve) => resolve({ data: rows.slice(0, 1000), error: null })
      };
      return query;
    }
  }
}));

import { fetchUserDirectory, userOrPlaceholder } from '../userDirectoryService';
import { loadAssignmentsForExport } from '../assignmentExportService';

const PROJECT = 'proj-1';

const row = (id, over = {}) => ({
  id: `a${String(id).padStart(5, '0')}`,
  schedule_id: 'sched-1',
  end_user_id: 1,
  course_id: 'A',
  functional_area: 'Finance',
  training_location: 'London',
  user_name: 'Name On Row',
  ...over
});

beforeEach(() => {
  mockTables = { user_assignments: [], end_users: [], training_data_combined: [] };
  mockRequests = [];
});

describe('fetchUserDirectory', () => {
  test('does nothing for an empty list', async () => {
    const directory = await fetchUserDirectory(PROJECT, []);
    expect(directory.size).toBe(0);
    expect(mockRequests).toHaveLength(0);
  });

  test('prefers end_users, and only looks in the training data for people it did not find', async () => {
    mockTables.end_users = [{ id: 1, project_id: PROJECT, name: 'In App', email: 'a@x.com', project_role: 'Clerk', training_location: 'London' }];
    mockTables.training_data_combined = [
      { project_id: PROJECT, user_id: '1', user_name: 'Should Not Win', user_email: 'no@x.com' },
      { project_id: PROJECT, user_id: '2', user_name: 'From Training Data', user_email: 'b@x.com', user_project_role: 'Buyer', training_location: 'Dubai', user_job_title: 'T', business_unit: 'BU' }
    ];
    const directory = await fetchUserDirectory(PROJECT, [1, 2]);
    expect(directory.get(1).name).toBe('In App');
    expect(directory.get(2)).toMatchObject({ name: 'From Training Data', email: 'b@x.com', project_role: 'Buyer', training_location: 'Dubai', division: 'BU' });
  });

  test('only reads this project\'s people', async () => {
    mockTables.end_users = [{ id: 1, project_id: 'other-project', name: 'Someone Else' }];
    const directory = await fetchUserDirectory(PROJECT, [1]);
    expect(directory.has(1)).toBe(false);
  });

  test('looks people up in small batches so no request is too large or hits the row limit', async () => {
    const ids = Array.from({ length: 450 }, (_, i) => i + 1);
    await fetchUserDirectory(PROJECT, ids);
    const endUserBatches = mockRequests.filter((r) => r.table === 'end_users').flatMap((r) => r.in.map((i) => i.count));
    const trainingBatches = mockRequests.filter((r) => r.table === 'training_data_combined').flatMap((r) => r.in.map((i) => i.count));
    expect(Math.max(...endUserBatches)).toBeLessThanOrEqual(200);
    expect(Math.max(...trainingBatches)).toBeLessThanOrEqual(40);
    expect(trainingBatches.reduce((a, b) => a + b, 0)).toBe(450); // everyone not found in end_users
  });

  test('a person nobody knows still gets a placeholder', () => {
    expect(userOrPlaceholder(new Map(), 42)).toEqual({ id: 42, name: 'User 42', email: null });
  });
});

describe('loadAssignmentsForExport', () => {
  test('never asks the database to embed end_users or training_sessions (that needs a link that does not exist)', async () => {
    mockTables.user_assignments = [row(1)];
    await loadAssignmentsForExport({ scheduleId: 'sched-1', projectId: PROJECT });
    const assignmentRequest = mockRequests.find((r) => r.table === 'user_assignments');
    expect(assignmentRequest.select).toBe('*');
  });

  test('returns every assignment, not just the first 1000', async () => {
    mockTables.user_assignments = Array.from({ length: 2500 }, (_, i) => row(i + 1, { end_user_id: (i % 50) + 1 }));
    const rows = await loadAssignmentsForExport({ scheduleId: 'sched-1', projectId: PROJECT });
    expect(rows).toHaveLength(2500);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2500); // no page repeated or skipped
  });

  test('fills in each person from end_users, in the shape the CSV code reads', async () => {
    mockTables.user_assignments = [row(1, { end_user_id: 7 })];
    mockTables.end_users = [{ id: 7, project_id: PROJECT, name: 'Real Name', project_role: 'Buyer', training_location: 'Manchester' }];
    const [assignment] = await loadAssignmentsForExport({ scheduleId: 'sched-1', projectId: PROJECT });
    expect(assignment.end_users).toEqual({ id: 7, name: 'Real Name', training_location: 'Manchester', project_role: 'Buyer' });
  });

  test('MS Access projects (no end_users rows): uses the training data, then the assignment row itself', async () => {
    mockTables.user_assignments = [row(1, { end_user_id: 7 }), row(2, { end_user_id: 8, user_name: 'Only On Row', training_location: 'Dubai' })];
    mockTables.training_data_combined = [{ project_id: PROJECT, user_id: '7', user_name: 'From Training Data', user_project_role: 'Analyst', training_location: 'Bahrain' }];
    const rows = await loadAssignmentsForExport({ scheduleId: 'sched-1', projectId: PROJECT });
    expect(rows[0].end_users).toMatchObject({ name: 'From Training Data', project_role: 'Analyst', training_location: 'Bahrain' });
    expect(rows[1].end_users).toMatchObject({ name: 'Only On Row', training_location: 'Dubai', project_role: null });
  });

  test('keeps only people in the chosen location, judged by the person\'s own location', async () => {
    mockTables.user_assignments = [row(1, { end_user_id: 1 }), row(2, { end_user_id: 2 })];
    mockTables.end_users = [
      { id: 1, project_id: PROJECT, name: 'A', training_location: 'London' },
      { id: 2, project_id: PROJECT, name: 'B', training_location: 'Manchester' }
    ];
    const rows = await loadAssignmentsForExport({ scheduleId: 'sched-1', projectId: PROJECT, locations: ['Manchester'] });
    expect(rows.map((r) => r.end_user_id)).toEqual([2]);
  });

  test('a stakeholder\'s locations and areas narrow the result further', async () => {
    mockTables.user_assignments = [
      row(1, { end_user_id: 1, functional_area: 'Finance' }),
      row(2, { end_user_id: 2, functional_area: 'HR' }),
      row(3, { end_user_id: 3, functional_area: 'Finance' })
    ];
    mockTables.end_users = [
      { id: 1, project_id: PROJECT, name: 'A', training_location: 'London' },
      { id: 2, project_id: PROJECT, name: 'B', training_location: 'London' },
      { id: 3, project_id: PROJECT, name: 'C', training_location: 'Leeds' }
    ];
    const rows = await loadAssignmentsForExport({
      scheduleId: 'sched-1', projectId: PROJECT, stakeholderLocations: ['London'], functionalAreas: ['Finance']
    });
    expect(rows.map((r) => r.end_user_id)).toEqual([1]);
  });

  test('empty filter lists mean "no filter"', async () => {
    mockTables.user_assignments = [row(1)];
    const rows = await loadAssignmentsForExport({
      scheduleId: 'sched-1', projectId: PROJECT, locations: [], stakeholderLocations: [], functionalAreas: []
    });
    expect(rows).toHaveLength(1);
  });

  test('only reads the chosen schedule', async () => {
    mockTables.user_assignments = [row(1), row(2, { schedule_id: 'other' })];
    const rows = await loadAssignmentsForExport({ scheduleId: 'sched-1', projectId: PROJECT });
    expect(rows).toHaveLength(1);
  });

  test('needs a schedule', async () => {
    await expect(loadAssignmentsForExport({ scheduleId: null, projectId: PROJECT })).rejects.toThrow('No schedule selected');
  });
});
