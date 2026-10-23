// Walk-in and clear support: the session numbers, the people search, and clearing a mark.
let mockCalls = [];
let mockResults = {};
jest.mock('@core/services/supabaseClient', () => ({
  supabase: {
    from: (table) => {
      const call = { table, op: 'select', filters: [], or: null, limit: null };
      mockCalls.push(call);
      const query = {
        select: () => query,
        delete: () => { call.op = 'delete'; return query; },
        eq: (column, value) => { call.filters.push([column, value]); return query; },
        or: (clause) => { call.or = clause; return query; },
        order: () => query,
        limit: (n) => { call.limit = n; return query; },
        then: (resolve) => resolve(typeof mockResults[table] === 'function' ? mockResults[table](call) : mockResults[table] || { data: [], error: null })
      };
      return query;
    }
  }
}));

import { summariseAttendance } from '../attendanceSummary';
import { searchUserDirectory } from '../userDirectoryService';
import { clearAttendanceRecord } from '../attendanceService';

beforeEach(() => {
  mockCalls = [];
  mockResults = {};
});

const rec = (attendee_id, status_name, is_present) => ({ attendee_id, attendance_statuses: { status_name, is_present } });

describe('summariseAttendance', () => {
  test('counts present and absent among the assigned people', () => {
    const summary = summariseAttendance([1, 2, 3, 4], [rec(1, 'Present', true), rec(2, 'Late', true), rec(3, 'Absent', false)]);
    expect(summary).toMatchObject({ total_registered: 4, total_attended: 2, total_absent: 1, total_walk_ins: 0, attendance_rate: 50 });
    expect(summary.status_breakdown).toEqual({ Present: 1, Late: 1, Absent: 1 });
  });

  test('walk-ins are counted on their own and never lift the rate above what was planned', () => {
    const summary = summariseAttendance([1, 2], [rec(1, 'Present', true), rec(2, 'Present', true), rec(99, 'Present', true), rec(98, 'Late', true)]);
    expect(summary.total_attended).toBe(2);
    expect(summary.total_walk_ins).toBe(2);
    expect(summary.attendance_rate).toBe(100);
  });

  test('an unassigned person marked absent is not counted as an absence', () => {
    const summary = summariseAttendance([1], [rec(1, 'Present', true), rec(99, 'Absent', false)]);
    expect(summary.total_absent).toBe(0);
    expect(summary.total_walk_ins).toBe(0);
  });

  test('nobody assigned gives a 0% rate rather than dividing by zero, and records without a status are ignored', () => {
    expect(summariseAttendance([], []).attendance_rate).toBe(0);
    expect(summariseAttendance([1], [{ attendee_id: 1, attendance_statuses: null }]).total_attended).toBe(0);
  });
});

describe('searchUserDirectory', () => {
  const person = { id: 1, name: 'Amelia Brown', email: 'a@x.com' };

  test('a search that is too short does nothing', async () => {
    expect(await searchUserDirectory('p1', 'a')).toEqual([]);
    expect(await searchUserDirectory('p1', '  ')).toEqual([]);
    expect(mockCalls).toHaveLength(0);
  });

  test('looks in end_users by name and email for this project, with a limit', async () => {
    mockResults.end_users = { data: [person], error: null };
    expect(await searchUserDirectory('p1', 'amel', 5)).toEqual([person]);
    const call = mockCalls[0];
    expect(call.table).toBe('end_users');
    expect(call.filters).toEqual([['project_id', 'p1']]);
    expect(call.or).toBe('name.ilike.*amel*,email.ilike.*amel*');
    expect(call.limit).toBe(5);
    expect(mockCalls).toHaveLength(1);
  });

  test('a number also matches the person ID', async () => {
    mockResults.end_users = { data: [person], error: null };
    await searchUserDirectory('p1', '100003');
    expect(mockCalls[0].or).toContain('id.eq.100003');
  });

  test('characters that mean something in a filter are removed from the search text', async () => {
    mockResults.end_users = { data: [person], error: null };
    await searchUserDirectory('p1', 'smith,(x)*%');
    expect(mockCalls[0].or).toBe('name.ilike.*smith x*,email.ilike.*smith x*');
  });

  test('with no end_users match it falls back to the imported training data, one entry per person', async () => {
    mockResults.end_users = { data: [], error: null };
    mockResults.training_data_combined = {
      data: [
        { user_id: '7', user_name: 'Zed Last', user_email: 'z@x.com', user_job_title: 'Buyer', business_unit: 'Ops', user_project_role: 'Buyer', training_location: 'London' },
        { user_id: '7', user_name: 'Zed Last', user_email: 'z@x.com', user_job_title: 'Buyer', business_unit: 'Ops', user_project_role: 'Buyer', training_location: 'London' },
        { user_id: '3', user_name: 'Ann First', user_email: 'a@x.com', user_job_title: null, business_unit: null, user_project_role: null, training_location: 'Leeds' }
      ],
      error: null
    };
    const found = await searchUserDirectory('p1', 'last');
    expect(found.map((p) => [p.id, p.name])).toEqual([[3, 'Ann First'], [7, 'Zed Last']]);
    expect(mockCalls[1].table).toBe('training_data_combined');
    expect(mockCalls[1].or).toBe('user_name.ilike.*last*,user_email.ilike.*last*');
  });

  test('a database error is raised rather than hidden', async () => {
    mockResults.end_users = { data: null, error: new Error('boom') };
    await expect(searchUserDirectory('p1', 'amel')).rejects.toThrow('boom');
  });
});

describe('clearAttendanceRecord', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});

  test('deletes only that person\'s record for that session in that project', async () => {
    mockResults.attendance_records = { data: [{ id: 'r1' }], error: null };
    expect(await clearAttendanceRecord('s1', 'p1', 4)).toBe(true);
    expect(mockCalls[0]).toMatchObject({ table: 'attendance_records', op: 'delete' });
    expect(mockCalls[0].filters).toEqual([['session_id', 's1'], ['attendee_id', 4], ['project_id', 'p1']]);
  });

  test('says false when there was nothing to clear, and needs a project', async () => {
    mockResults.attendance_records = { data: [], error: null };
    expect(await clearAttendanceRecord('s1', 'p1', 4)).toBe(false);
    await expect(clearAttendanceRecord('s1', null, 4)).rejects.toThrow(/Project ID is required/);
  });

  test('a database error is raised', async () => {
    mockResults.attendance_records = { data: null, error: new Error('denied') };
    await expect(clearAttendanceRecord('s1', 'p1', 4)).rejects.toThrow('denied');
  });
});
