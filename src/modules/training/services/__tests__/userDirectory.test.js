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

const PROJECT = 'proj-1';

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
