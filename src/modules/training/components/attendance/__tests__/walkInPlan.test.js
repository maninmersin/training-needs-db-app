import { CHOICE, availableChoices, buildWalkInPlan, findOtherBookings, targetSeats } from '../walkInPlan';

const session = (id, over = {}) => ({
  id, course_id: 'C1', course_name: 'Ledger Basics', session_number: 2, session_part_number: 1, session_identifier: `C1-2-${id}`,
  start_datetime: '2026-10-14T09:30:00', end_datetime: '2026-10-14T12:30:00', training_location: 'London', functional_area: 'Finance',
  classroom_number: 1, max_attendees: 2, instructor_name: '', ...over
});

// The session being attended: Group 2 at London, two parts (days)
const T1 = session('t1');
const T2 = session('t2', { session_part_number: 2, start_datetime: '2026-10-15T09:30:00' });
// The session the person was booked on: Group 1 at Leeds, two parts
const O1 = session('o1', { session_number: 1, training_location: 'Leeds', start_datetime: '2026-10-07T09:30:00' });
const O2 = session('o2', { session_number: 1, training_location: 'Leeds', session_part_number: 2, start_datetime: '2026-10-08T09:30:00' });
// The same course's other-course session, which must be ignored
const OTHER_COURSE = session('x1', { course_id: 'C9', course_name: 'Other' });

const person = { id: 7, name: 'Amelia Brown', email: 'a@x.com' };
const schedule = { id: 'sch1', project_id: 'p1' };
const NOW = new Date('2026-10-14T10:00:00Z');
const rows = (...pairs) => pairs.map(([id, session_id, course_id = 'C1']) => ({ id, session_id, course_id }));

describe('findOtherBookings', () => {
  test('groups the person\'s rows by session group and describes where they were booked', () => {
    const other = findOtherBookings({ existingRows: rows(['r1', 'o1'], ['r2', 'o2']), existingSessions: [O1, O2], targetSession: T1 });
    expect(other).toHaveLength(1);
    expect(other[0]).toMatchObject({ sessionNumber: 1, location: 'Leeds', courseName: 'Ledger Basics', rowIds: ['r1', 'r2'], sessionIds: ['o1', 'o2'], firstStart: '2026-10-07T09:30:00' });
  });

  test('a booking on the group being attended, or on another course, is not "another booking"', () => {
    const other = findOtherBookings({ existingRows: rows(['r1', 't1'], ['r3', 'x1', 'C9']), existingSessions: [T1, OTHER_COURSE], targetSession: T1 });
    expect(other).toEqual([]);
  });

  test('a booking on a session we cannot see is ignored rather than breaking', () => {
    expect(findOtherBookings({ existingRows: rows(['r1', 'gone']), existingSessions: [], targetSession: T1 })).toEqual([]);
  });

  test('several other groups are listed earliest first', () => {
    const later = session('l1', { session_number: 3, start_datetime: '2026-10-21T09:30:00' });
    const other = findOtherBookings({ existingRows: rows(['r1', 'l1'], ['r2', 'o1']), existingSessions: [later, O1], targetSession: T1 });
    expect(other.map((g) => g.sessionNumber)).toEqual([1, 3]);
  });
});

describe('availableChoices', () => {
  test('with another booking: move first, then attend as well, then attendance only', () => {
    expect(availableChoices([{}]).map((c) => c.value)).toEqual([CHOICE.MOVE, CHOICE.ALSO, CHOICE.ATTENDANCE_ONLY]);
  });

  test('with no booking: assign first, then attendance only', () => {
    expect(availableChoices([]).map((c) => c.value)).toEqual([CHOICE.ASSIGN, CHOICE.ATTENDANCE_ONLY]);
  });
});

describe('targetSeats', () => {
  test('counts distinct people across the parts of the group, and says when it is full', () => {
    const seatRows = [{ session_id: 't1', end_user_id: 1 }, { session_id: 't2', end_user_id: 1 }, { session_id: 't1', end_user_id: 2 }];
    expect(targetSeats([T1, T2], seatRows)).toMatchObject({ seatsTaken: 2, maxAttendees: 2, seatsLeft: 0, isFull: true });
    expect(targetSeats([T1, T2], seatRows.slice(0, 2))).toMatchObject({ seatsTaken: 1, seatsLeft: 1, isFull: false });
    expect(targetSeats([], [])).toBeNull();
  });
});

describe('buildWalkInPlan', () => {
  const base = { session: T1, targetParts: [T1, T2], person, schedule, now: NOW };

  test('attendance only changes nothing', () => {
    expect(buildWalkInPlan({ ...base, choice: CHOICE.ATTENDANCE_ONLY })).toMatchObject({ deleteIds: [], newRows: [], oldSessionIds: [] });
  });

  test('a true walk-in is assigned to the session they attended only, tagged as a walk-in', () => {
    const plan = buildWalkInPlan({ ...base, choice: CHOICE.ASSIGN });
    expect(plan.deleteIds).toEqual([]);
    expect(plan.newRows).toHaveLength(1);
    expect(plan.newRows[0]).toMatchObject({
      schedule_id: 'sch1', project_id: 'p1', end_user_id: 7, user_name: 'Amelia Brown', user_email: 'a@x.com', session_id: 't1',
      course_id: 'C1', training_location: 'London', functional_area: 'Finance', group_identifier: 'Group 2',
      assignment_level: 'session', assignment_source: 'attendance', assignment_method: 'walk-in'
    });
    expect(plan.newRows[0].notes).toBe('Added as a walk-in on 2026-10-14 (attended without being assigned)');
  });

  test('assigning someone who already has a row for this session adds nothing', () => {
    const plan = buildWalkInPlan({ ...base, choice: CHOICE.ASSIGN, existingRows: rows(['r1', 't1']) });
    expect(plan.newRows).toEqual([]);
  });

  test('"attend as well" keeps the old booking: it only adds this session', () => {
    const other = findOtherBookings({ existingRows: rows(['r1', 'o1']), existingSessions: [O1], targetSession: T1 });
    const plan = buildWalkInPlan({ ...base, choice: CHOICE.ALSO, otherBookings: other, existingRows: rows(['r1', 'o1']) });
    expect(plan.deleteIds).toEqual([]);
    expect(plan.newRows.map((r) => r.session_id)).toEqual(['t1']);
    expect(plan.newRows[0].assignment_method).toBe('walk-in');
  });

  test('a move removes the old booking and books every part of the new group as a normal manual booking', () => {
    const existing = rows(['r1', 'o1'], ['r2', 'o2']);
    const other = findOtherBookings({ existingRows: existing, existingSessions: [O1, O2], targetSession: T1 });
    const plan = buildWalkInPlan({ ...base, choice: CHOICE.MOVE, otherBookings: other, existingRows: existing });
    expect(plan.deleteIds).toEqual(['r1', 'r2']);
    expect(plan.oldSessionIds).toEqual(['o1', 'o2']);
    expect(plan.newRows.map((r) => r.session_id)).toEqual(['t1', 't2']);
    expect(plan.newRows.every((r) => r.assignment_method === 'manual' && r.assignment_source === 'manual' && r.group_identifier === 'Group 2')).toBe(true);
    expect(plan.newRows[0].notes).toBe('Moved from Group 1 (Leeds) to Group 2 (London) on 2026-10-14 - attended this session instead');
    expect(plan.summary).toBe(plan.newRows[0].notes);
  });

  test('a move skips parts of the new group the person is already booked on', () => {
    const existing = rows(['r1', 'o1'], ['r2', 'o2'], ['r3', 't2']);
    const other = findOtherBookings({ existingRows: existing, existingSessions: [O1, O2, T2], targetSession: T1 });
    const plan = buildWalkInPlan({ ...base, choice: CHOICE.MOVE, otherBookings: other, existingRows: existing });
    expect(plan.newRows.map((r) => r.session_id)).toEqual(['t1']);
    expect(plan.deleteIds).toEqual(['r1', 'r2']);
  });

  test('a move needs another booking, and an unknown choice is refused', () => {
    expect(() => buildWalkInPlan({ ...base, choice: CHOICE.MOVE, otherBookings: [] })).toThrow(/nothing to move/);
    expect(() => buildWalkInPlan({ ...base, choice: 'bogus' })).toThrow(/Unknown choice/);
  });
});
