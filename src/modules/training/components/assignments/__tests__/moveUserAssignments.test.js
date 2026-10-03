import { MOVE_SCOPE, buildSessionGroups, findMoveOptions, buildMovePlan, resolveSource } from '../moveUserAssignments';

const LOCATION = 'London';
const AREA = 'Supply Chain';
const SCHEDULE = { id: 'sched-1', project_id: 'proj-1' };

// One training_sessions row per course session PART
let nextId = 1;
const part = (course_id, session_number, session_part_number, over = {}) => ({
  id: `s${nextId++}`,
  course_id,
  course_name: `Course ${course_id}`,
  session_number,
  session_part_number,
  session_identifier: `${course_id}-session${session_number}-london-supply-chain-part${session_part_number}`,
  start_datetime: `2026-10-${String(12 + session_number * 2 + session_part_number).padStart(2, '0')}T09:30:00`,
  end_datetime: `2026-10-${String(12 + session_number * 2 + session_part_number).padStart(2, '0')}T12:30:00`,
  training_location: LOCATION,
  functional_area: AREA,
  classroom_number: session_number,
  max_attendees: 2,
  instructor_name: '',
  ...over
});

// Two courses, three groups each; course A has two parts per group, course B has one
const buildSessions = () => {
  nextId = 1;
  const sessions = [];
  for (const n of [1, 2, 3]) {
    sessions.push(part('A', n, 1), part('A', n, 2), part('B', n, 1));
  }
  return sessions;
};

// The person's rows: in Group 1 of both courses
const rowsFor = (sessions, userId, groupNumber, courses = ['A', 'B']) =>
  sessions
    .filter((s) => courses.includes(s.course_id) && s.session_number === groupNumber)
    .map((s) => ({
      id: `row-${userId}-${s.id}`, end_user_id: userId, session_id: s.id, course_id: s.course_id,
      group_identifier: `Group ${groupNumber}`, user_name: 'Pat Example', user_email: 'pat@example.com'
    }));

const sourceA1 = { courseId: 'A', sessionNumber: 1, location: LOCATION, functionalArea: AREA };

describe('buildSessionGroups', () => {
  test('collapses parts into one group per course, session number, location and area', () => {
    const groups = buildSessionGroups(buildSessions());
    expect(groups.size).toBe(6); // 2 courses x 3 groups
    const a1 = [...groups.values()].find((g) => g.courseId === 'A' && g.sessionNumber === 1);
    expect(a1.parts.map((p) => p.session_part_number)).toEqual([1, 2]);
    expect(a1.maxAttendees).toBe(2);
  });
});

describe('findMoveOptions - this course only', () => {
  test('offers the other sessions of the same course, not the current one or other courses', () => {
    const sessions = buildSessions();
    const options = findMoveOptions({
      sessions, userRows: rowsFor(sessions, 1, 1), seatRows: [], source: sourceA1, scope: MOVE_SCOPE.COURSE
    });
    expect(options.map((o) => [o.courseId, o.sessionNumber])).toEqual([['A', 2], ['A', 3]]);
  });

  test('only sessions at the same location and functional area', () => {
    const sessions = [
      ...buildSessions(),
      part('A', 4, 1, { training_location: 'Manchester' }),
      part('A', 5, 1, { functional_area: 'Finance' })
    ];
    const options = findMoveOptions({
      sessions, userRows: rowsFor(sessions, 1, 1), seatRows: [], source: sourceA1, scope: MOVE_SCOPE.COURSE
    });
    expect(options.map((o) => o.sessionNumber)).toEqual([2, 3]);
  });

  test('counts seats by distinct people and flags full sessions', () => {
    const sessions = buildSessions();
    const a2 = sessions.filter((s) => s.course_id === 'A' && s.session_number === 2);
    // two people each hold both parts of A group 2 (4 rows, 2 people) => full at max 2
    const seatRows = [10, 11].flatMap((userId) => a2.map((s) => ({ session_id: s.id, end_user_id: userId })));
    const options = findMoveOptions({
      sessions, userRows: rowsFor(sessions, 1, 1), seatRows, source: sourceA1, scope: MOVE_SCOPE.COURSE
    });
    const group2 = options.find((o) => o.sessionNumber === 2);
    expect(group2).toMatchObject({ seatsTaken: 2, maxAttendees: 2, seatsLeft: 0, isFull: true });
    expect(options.find((o) => o.sessionNumber === 3)).toMatchObject({ seatsTaken: 0, seatsLeft: 2, isFull: false });
  });

  test('does not offer a session the person is already in', () => {
    const sessions = buildSessions();
    const userRows = [...rowsFor(sessions, 1, 1), ...rowsFor(sessions, 1, 3, ['A'])];
    const options = findMoveOptions({ sessions, userRows, seatRows: [], source: sourceA1, scope: MOVE_SCOPE.COURSE });
    expect(options.map((o) => o.sessionNumber)).toEqual([2]);
  });

  test('nothing to offer when there is no other session', () => {
    const sessions = buildSessions().filter((s) => s.session_number === 1);
    const options = findMoveOptions({
      sessions, userRows: rowsFor(sessions, 1, 1), seatRows: [], source: sourceA1, scope: MOVE_SCOPE.COURSE
    });
    expect(options).toEqual([]);
  });
});

describe('findMoveOptions - whole group', () => {
  test('offers other groups that run all of the person\'s courses', () => {
    const sessions = buildSessions();
    const options = findMoveOptions({
      sessions, userRows: rowsFor(sessions, 1, 1), seatRows: [], source: sourceA1, scope: MOVE_SCOPE.GROUP
    });
    expect(options.map((o) => [o.sessionNumber, o.canMove])).toEqual([[2, true], [3, true]]);
    expect(options[0].courses.map((c) => c.courseId).sort()).toEqual(['A', 'B']);
  });

  test('a group missing one of the courses is listed but cannot be chosen', () => {
    const sessions = buildSessions().filter((s) => !(s.course_id === 'B' && s.session_number === 3));
    const options = findMoveOptions({
      sessions, userRows: rowsFor(sessions, 1, 1), seatRows: [], source: sourceA1, scope: MOVE_SCOPE.GROUP
    });
    const group3 = options.find((o) => o.sessionNumber === 3);
    expect(group3.canMove).toBe(false);
    expect(group3.missingCourses.map((c) => c.courseId)).toEqual(['B']);
  });

  test('a group is full if any of its courses is full', () => {
    const sessions = buildSessions();
    const b2 = sessions.find((s) => s.course_id === 'B' && s.session_number === 2);
    const seatRows = [10, 11].map((userId) => ({ session_id: b2.id, end_user_id: userId }));
    const options = findMoveOptions({
      sessions, userRows: rowsFor(sessions, 1, 1), seatRows, source: sourceA1, scope: MOVE_SCOPE.GROUP
    });
    const group2 = options.find((o) => o.sessionNumber === 2);
    expect(group2.isFull).toBe(true);
    expect(group2.fullCourses.map((c) => c.courseId)).toEqual(['B']);
  });

  test('only moves the courses the person actually takes', () => {
    const sessions = buildSessions();
    const options = findMoveOptions({
      sessions, userRows: rowsFor(sessions, 1, 1, ['A']), seatRows: [], source: sourceA1, scope: MOVE_SCOPE.GROUP
    });
    expect(options[0].courses.map((c) => c.courseId)).toEqual(['A']);
  });
});

describe('buildMovePlan', () => {
  const user = { userId: 1, name: 'Pat Example' };
  const now = new Date('2026-10-05T10:00:00Z');

  test('course move: removes the old session rows and adds one row per part of the new session', () => {
    const sessions = buildSessions();
    const userRows = rowsFor(sessions, 1, 1);
    const [option] = findMoveOptions({ sessions, userRows, seatRows: [], source: sourceA1, scope: MOVE_SCOPE.COURSE });
    const plan = buildMovePlan({ option, sessions, userRows, user, schedule: SCHEDULE, source: sourceA1, now });

    // removes only course A group 1 (2 parts); course B is untouched
    const a1Ids = sessions.filter((s) => s.course_id === 'A' && s.session_number === 1).map((s) => `row-1-${s.id}`);
    expect(plan.deleteIds.sort()).toEqual(a1Ids.sort());

    expect(plan.newRows).toHaveLength(2);
    expect(plan.newRows.map((r) => r.session_identifier)).toEqual([
      'A-session2-london-supply-chain-part1', 'A-session2-london-supply-chain-part2'
    ]);
    expect(plan.newRows[0]).toMatchObject({
      schedule_id: 'sched-1', project_id: 'proj-1', end_user_id: 1, course_id: 'A',
      group_identifier: 'Group 2', assignment_level: 'session', assignment_status: 'enrolled',
      assignment_source: 'manual', user_name: 'Pat Example', user_email: 'pat@example.com',
      training_location: LOCATION, functional_area: AREA
    });
    expect(plan.newRows[0].notes).toBe('Moved from Group 1 to Group 2 on 2026-10-05');
  });

  test('group move: moves every course the person takes in the group', () => {
    const sessions = buildSessions();
    const userRows = rowsFor(sessions, 1, 1);
    const options = findMoveOptions({ sessions, userRows, seatRows: [], source: sourceA1, scope: MOVE_SCOPE.GROUP });
    const plan = buildMovePlan({ option: options[0], sessions, userRows, user, schedule: SCHEDULE, source: sourceA1, now });

    expect(plan.deleteIds).toHaveLength(3); // A part 1, A part 2, B
    expect(plan.newRows).toHaveLength(3);
    expect(new Set(plan.newRows.map((r) => r.course_id))).toEqual(new Set(['A', 'B']));
    expect(new Set(plan.newRows.map((r) => r.group_identifier))).toEqual(new Set(['Group 2']));
  });

  test('every new row points at a real destination session id', () => {
    const sessions = buildSessions();
    const userRows = rowsFor(sessions, 1, 1);
    const options = findMoveOptions({ sessions, userRows, seatRows: [], source: sourceA1, scope: MOVE_SCOPE.GROUP });
    const plan = buildMovePlan({ option: options[1], sessions, userRows, user, schedule: SCHEDULE, source: sourceA1, now });
    const group3Ids = new Set(sessions.filter((s) => s.session_number === 3).map((s) => s.id));
    expect(plan.newRows.every((r) => group3Ids.has(r.session_id))).toBe(true);
  });

  test('refuses when the person is not in the source session', () => {
    const sessions = buildSessions();
    const userRows = rowsFor(sessions, 1, 2); // in group 2, but we say group 1
    const [option] = findMoveOptions({ sessions, userRows, seatRows: [], source: { ...sourceA1, sessionNumber: 2 }, scope: MOVE_SCOPE.COURSE });
    expect(() => buildMovePlan({ option, sessions, userRows, user, schedule: SCHEDULE, source: sourceA1, now })).toThrow(/not assigned/);
  });

  test('refuses a group move into a group that is missing one of the courses', () => {
    const sessions = buildSessions().filter((s) => !(s.course_id === 'B' && s.session_number === 3));
    const userRows = rowsFor(sessions, 1, 1);
    const options = findMoveOptions({ sessions, userRows, seatRows: [], source: sourceA1, scope: MOVE_SCOPE.GROUP });
    const blocked = options.find((o) => o.sessionNumber === 3);
    expect(() => buildMovePlan({ option: blocked, sessions, userRows, user, schedule: SCHEDULE, source: sourceA1, now })).toThrow(/does not run all/);
  });
});

describe('resolveSource', () => {
  test('reads a calendar-style session (as the assignment calendar passes it)', () => {
    expect(resolveSource({
      course_id: 'A', course_name: 'Alpha', sessionNumber: 2, functional_area: 'Finance', location: 'London'
    })).toEqual({ courseId: 'A', courseName: 'Alpha', sessionNumber: 2, location: 'London', functionalArea: 'Finance' });
  });

  test('reads a database-style session and the fields the panel adds', () => {
    expect(resolveSource({
      course_id: 'A', session_number: '3', training_location: 'Leeds', _functionalArea: 'HR'
    })).toMatchObject({ courseId: 'A', sessionNumber: 3, location: 'Leeds', functionalArea: 'HR' });
  });

  test('missing details come back undefined, not as a wrong default', () => {
    const source = resolveSource({});
    expect(source.sessionNumber).toBeUndefined();
    expect(source.courseId).toBeUndefined();
    expect(resolveSource(null).location).toBeUndefined();
  });
});
