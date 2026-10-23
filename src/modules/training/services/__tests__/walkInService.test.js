// Loading a person's bookings and saving a walk-in plan, against a small stand-in for the database.
let mockCalls = [];
let mockData = {};
jest.mock('../assignmentMoveService', () => ({ SESSION_COLUMNS: 'id, course_id', saveMove: jest.fn() }));
jest.mock('@core/services/supabaseClient', () => ({
  supabase: {
    from: (table) => {
      const call = { table, op: 'select', filters: [], rows: null };
      mockCalls.push(call);
      const query = {
        select: () => query,
        insert: (rows) => { call.op = 'insert'; call.rows = rows; return query; },
        delete: () => { call.op = 'delete'; return query; },
        eq: (column, value) => { call.filters.push(['eq', column, value]); return query; },
        in: (column, value) => { call.filters.push(['in', column, value]); return query; },
        order: () => query,
        range: () => Promise.resolve(answer()),
        then: (resolve) => resolve(answer())
      };
      const answer = () => {
        const result = typeof mockData[table] === 'function' ? mockData[table](call) : mockData[table];
        return result || { data: [], error: null };
      };
      return query;
    }
  }
}));

import { saveMove } from '../assignmentMoveService';
import { applyWalkInPlan, loadWalkInContext } from '../walkInService';

beforeEach(() => {
  mockCalls = [];
  mockData = {};
  saveMove.mockReset();
});

const SESSION = { id: 't1', schedule_id: 'sch1', course_id: 'C1', session_number: 2, training_location: 'London', functional_area: 'Finance' };

describe('loadWalkInContext', () => {
  test('a session that is not part of a schedule cannot be checked', async () => {
    await expect(loadWalkInContext({ session: { id: 'x' }, endUserId: 7 })).rejects.toThrow(/not part of a schedule/);
  });

  test('reads the person\'s bookings on the course, where they are, and the seats taken in the session group', async () => {
    mockData.user_assignments = (call) =>
      call.filters.some(([, column]) => column === 'end_user_id')
        ? { data: [{ id: 'r1', session_id: 'o1', course_id: 'C1' }], error: null }
        : { data: [{ id: 'a', session_id: 't1', end_user_id: 3 }], error: null };
    mockData.training_sessions = (call) =>
      call.filters.some(([kind, column]) => kind === 'in' && column === 'id')
        ? { data: [{ id: 'o1' }], error: null }
        : { data: [{ id: 't1' }, { id: 't2' }], error: null };
    const context = await loadWalkInContext({ session: SESSION, endUserId: 7 });
    expect(context.existingRows).toHaveLength(1);
    expect(context.existingSessions).toEqual([{ id: 'o1' }]);
    expect(context.targetParts.map((p) => p.id)).toEqual(['t1', 't2']);
    expect(context.seatRows).toEqual([{ id: 'a', session_id: 't1', end_user_id: 3 }]);

    const mine = mockCalls.find((c) => c.table === 'user_assignments' && c.filters.some(([, col]) => col === 'end_user_id'));
    expect(mine.filters).toEqual(expect.arrayContaining([['eq', 'schedule_id', 'sch1'], ['eq', 'end_user_id', 7], ['eq', 'course_id', 'C1']]));
    const target = mockCalls.find((c) => c.table === 'training_sessions' && c.filters.some(([, col]) => col === 'session_number'));
    expect(target.filters).toEqual(expect.arrayContaining([['eq', 'session_number', 2], ['eq', 'training_location', 'London'], ['eq', 'functional_area', 'Finance']]));
  });

  test('someone with no bookings skips the lookups that need them', async () => {
    mockData.training_sessions = { data: [{ id: 't1' }], error: null };
    const context = await loadWalkInContext({ session: SESSION, endUserId: 7 });
    expect(context.existingRows).toEqual([]);
    expect(context.existingSessions).toEqual([]);
    expect(mockCalls.filter((c) => c.table === 'training_sessions')).toHaveLength(1);
  });
});

describe('applyWalkInPlan', () => {
  const move = { deleteIds: ['r1', 'r2'], newRows: [{ session_id: 't1' }, { session_id: 't2' }], oldSessionIds: ['o1', 'o2'], summary: '' };

  test('a move is one all-or-nothing save, then the old absence mark at the old session is removed', async () => {
    mockData.attendance_records = { data: [{ id: 'm1' }], error: null };
    const result = await applyWalkInPlan({ plan: move, projectId: 'p1', endUserId: 7, absentStatusIds: [2, 4] });
    expect(saveMove).toHaveBeenCalledWith({ deleteIds: ['r1', 'r2'], newRows: move.newRows });
    expect(result).toEqual({ assigned: 2, removed: 2, clearedOldMarks: 1 });
    const cleared = mockCalls.find((c) => c.table === 'attendance_records');
    expect(cleared.op).toBe('delete');
    expect(cleared.filters).toEqual(expect.arrayContaining([['eq', 'project_id', 'p1'], ['eq', 'attendee_id', 7], ['in', 'session_id', ['o1', 'o2']], ['in', 'attendance_status_id', [2, 4]]]));
  });

  test('if the move itself fails nothing else is touched', async () => {
    saveMove.mockRejectedValue(new Error('Expected to remove 2 assignments but removed 1'));
    await expect(applyWalkInPlan({ plan: move, projectId: 'p1', endUserId: 7, absentStatusIds: [2] })).rejects.toThrow(/Expected to remove/);
    expect(mockCalls.filter((c) => c.table === 'attendance_records')).toHaveLength(0);
  });

  test('a true walk-in is a plain insert of the new booking', async () => {
    const plan = { deleteIds: [], newRows: [{ session_id: 't1', assignment_method: 'walk-in' }], oldSessionIds: [], summary: '' };
    const result = await applyWalkInPlan({ plan, projectId: 'p1', endUserId: 7, absentStatusIds: [2] });
    expect(saveMove).not.toHaveBeenCalled();
    expect(mockCalls[0]).toMatchObject({ table: 'user_assignments', op: 'insert', rows: plan.newRows });
    expect(result).toEqual({ assigned: 1, removed: 0, clearedOldMarks: 0 });
    expect(mockCalls.some((c) => c.table === 'attendance_records')).toBe(false);
  });

  test('a failed insert is raised', async () => {
    mockData.user_assignments = { data: null, error: new Error('duplicate key') };
    await expect(applyWalkInPlan({ plan: { deleteIds: [], newRows: [{}], oldSessionIds: [], summary: '' }, projectId: 'p1', endUserId: 7 })).rejects.toThrow('duplicate key');
  });

  test('a plan with no changes does nothing at all', async () => {
    const result = await applyWalkInPlan({ plan: { deleteIds: [], newRows: [], oldSessionIds: [], summary: '' }, projectId: 'p1', endUserId: 7 });
    expect(mockCalls).toHaveLength(0);
    expect(result).toEqual({ assigned: 0, removed: 0, clearedOldMarks: 0 });
  });

  test('if the old absence mark cannot be removed, the message says the booking was already changed', async () => {
    mockData.attendance_records = { data: null, error: { message: 'denied' } };
    await expect(applyWalkInPlan({ plan: move, projectId: 'p1', endUserId: 7, absentStatusIds: [2] })).rejects.toThrow(/booking was changed, but their old absence mark could not be removed/);
  });
});
