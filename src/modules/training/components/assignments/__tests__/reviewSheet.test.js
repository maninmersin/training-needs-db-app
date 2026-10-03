import {
  REVIEW_COLUMNS,
  buildReviewModel,
  parseMoveTo,
  parseReviewRows,
  planReviewImport,
  scopeList,
  combineScopeLists,
  outcomesToCsv
} from '../reviewSheet';

const LOCATION = 'London';
const AREA = 'Supply Chain';
const SCHEDULE = { id: 'sched-1', project_id: 'proj-1' };

let nextId = 1;
const part = (course_id, session_number, session_part_number, over = {}) => ({
  id: `s${nextId++}`, course_id, course_name: `Course ${course_id}`, session_number, session_part_number,
  session_identifier: `${course_id}-session${session_number}-part${session_part_number}`,
  start_datetime: `2026-10-${String(12 + session_number * 2 + session_part_number).padStart(2, '0')}T09:30:00`,
  end_datetime: `2026-10-${String(12 + session_number * 2 + session_part_number).padStart(2, '0')}T12:30:00`,
  training_location: LOCATION, functional_area: AREA, classroom_number: session_number,
  max_attendees: 2, instructor_name: '', ...over
});

// Course A: 2 parts per group, 3 groups. Course B: 1 part per group, 2 groups.
const buildSessions = () => {
  nextId = 1;
  const sessions = [];
  for (const n of [1, 2, 3]) sessions.push(part('A', n, 1), part('A', n, 2));
  for (const n of [1, 2]) sessions.push(part('B', n, 1));
  return sessions;
};

let rowSeq = 1;
const assignTo = (sessions, userId, course, groupNumber, over = {}) =>
  sessions.filter((s) => s.course_id === course && s.session_number === groupNumber && s.training_location === LOCATION).map((s) => ({
    id: `row${rowSeq++}`, end_user_id: userId, session_id: s.id, course_id: s.course_id,
    user_name: `Person ${userId}`, user_email: `p${userId}@example.com`, training_location: LOCATION, functional_area: AREA, ...over
  }));

const directory = new Map([
  [1, { id: 1, name: 'Ann One', email: 'ann@example.com', project_role: 'Buyer' }],
  [2, { id: 2, name: 'Bob Two', email: 'bob@example.com', project_role: 'Clerk' }],
  [3, { id: 3, name: 'Cat Three', email: 'cat@example.com', project_role: 'Clerk' }]
]);

// A row as it would come back from the file, keyed by header text
const fileRow = (over = {}) => ({
  Person: 'Ann One', Email: '', 'Training Location': LOCATION, 'Functional Area': AREA, 'Project Role': '',
  Course: 'Course A', 'Current Group': 'Group 1', 'Current Dates': '', 'Move To Group': '', 'Change Reason': '',
  'Person ID (do not change)': 1, 'Course ID (do not change)': 'A', ...over
});

const plan = (rawRows, { sessions, assignments, ...rest }) => {
  const { items } = parseReviewRows(rawRows);
  return planReviewImport({ items, sessions, assignments, directory, schedule: SCHEDULE, ...rest });
};

describe('buildReviewModel', () => {
  test('one row per person per course, however many parts the course has', () => {
    const sessions = buildSessions();
    const assignments = [...assignTo(sessions, 1, 'A', 1), ...assignTo(sessions, 1, 'B', 1), ...assignTo(sessions, 2, 'A', 2)];
    const { rows, people } = buildReviewModel({ sessions, assignments, directory });
    expect(assignments).toHaveLength(5); // 2 + 1 + 2 session rows
    expect(rows).toHaveLength(3);        // but 3 person-courses
    expect(people).toBe(2);
  });

  test('each row carries what the reviewer needs and the IDs the import needs', () => {
    const sessions = buildSessions();
    const { rows } = buildReviewModel({ sessions, assignments: assignTo(sessions, 1, 'A', 2), directory });
    expect(rows[0]).toMatchObject({
      person: 'Ann One', email: 'ann@example.com', location: LOCATION, area: AREA, role: 'Buyer',
      course: 'Course A', currentGroup: 'Group 2', moveTo: '', reason: '', personId: 1, courseId: 'A'
    });
    expect(rows[0].currentDates).toMatch(/Oct/);
  });

  test('falls back to the name and email on the assignment row when the person has no directory entry', () => {
    const sessions = buildSessions();
    const { rows } = buildReviewModel({ sessions, assignments: assignTo(sessions, 9, 'A', 1), directory });
    expect(rows[0]).toMatchObject({ person: 'Person 9', email: 'p9@example.com' });
  });

  test('a stakeholder\'s locations and areas narrow what they are given', () => {
    const sessions = [...buildSessions(), part('A', 1, 1, { training_location: 'Leeds', id: 'leeds-1' })];
    const assignments = [
      ...assignTo(sessions, 1, 'A', 1),
      { id: 'x', end_user_id: 2, session_id: 'leeds-1', course_id: 'A', user_name: 'Bob' }
    ];
    expect(buildReviewModel({ sessions, assignments, directory, filters: { locations: ['Leeds'] } }).rows.map((r) => r.personId)).toEqual([2]);
    expect(buildReviewModel({ sessions, assignments, directory, filters: { functionalAreas: ['Finance'] } }).rows).toEqual([]);
  });

  test('lists the valid groups for each course with seats left (the Group Options sheet)', () => {
    const sessions = buildSessions();
    const assignments = [...assignTo(sessions, 1, 'A', 1), ...assignTo(sessions, 2, 'A', 2), ...assignTo(sessions, 3, 'A', 2)];
    const { optionsRows } = buildReviewModel({ sessions, assignments, directory });
    const courseA = optionsRows.filter((o) => o['Course ID'] === 'A');
    expect(courseA.map((o) => o.Group)).toEqual(['Group 1', 'Group 2', 'Group 3']);
    expect(courseA.find((o) => o.Group === 'Group 2')).toMatchObject({ 'Seats Taken': 2, 'Max Seats': 2, 'Seats Left': 0 });
    expect(optionsRows.some((o) => o['Course ID'] === 'B')).toBe(false); // nobody in B, so not listed
  });
});

describe('parseMoveTo', () => {
  test.each([
    [undefined, null], [null, null], ['', null], ['   ', null], ['keep', null], ['No change', null], ['-', null],
    [2, 2], ['2', 2], ['Group 2', 2], ['group 3', 3], ['Group 2 - Tue 14 Oct 09:30', 2]
  ])('%p -> %p', (input, expected) => {
    expect(parseMoveTo(input)).toEqual({ value: expected });
  });

  test.each(['later', 'Tuesday one', 0, -1, 1.5, 'Group 0'])('%p is rejected with a message', (input) => {
    const result = parseMoveTo(input);
    expect(result.value).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe('parseReviewRows', () => {
  test('reads the headers the review sheet uses, including the "(do not change)" ones', () => {
    const { items, missingColumns } = parseReviewRows([fileRow({ 'Move To Group': 'Group 2', 'Change Reason': ' Clash ' })]);
    expect(missingColumns).toEqual([]);
    expect(items[0]).toMatchObject({
      rowNumber: 2, personId: 1, courseId: 'A', location: LOCATION, area: AREA, currentGroup: 1, moveTo: 2, reason: 'Clash'
    });
  });

  test('is forgiving about header spelling, case and spacing', () => {
    const { items, missingColumns } = parseReviewRows([{
      'person id': 1, 'COURSE ID': 'A', 'current group': 'Group 1', 'training location': LOCATION,
      'functional area': AREA, 'move to group': '3'
    }]);
    expect(missingColumns).toEqual([]);
    expect(items[0].moveTo).toBe(3);
  });

  test('reports required columns that are missing', () => {
    const row = fileRow();
    delete row['Person ID (do not change)'];
    delete row['Move To Group'];
    const { missingColumns } = parseReviewRows([row]);
    expect([...missingColumns].sort()).toEqual(['Move To Group', 'Person ID (do not change)']);
  });

  test('skips completely empty rows but keeps row numbers right', () => {
    const empty = Object.fromEntries(REVIEW_COLUMNS.map((c) => [c.header, '']));
    const { items } = parseReviewRows([fileRow(), empty, fileRow({ 'Move To Group': 2 })]);
    expect(items.map((i) => i.rowNumber)).toEqual([2, 4]);
  });

  test('a bad Move To value is carried as an error on that row only', () => {
    const { items } = parseReviewRows([fileRow({ 'Move To Group': 'next week' }), fileRow({ 'Move To Group': 2 })]);
    expect(items[0].moveToError).toBeTruthy();
    expect(items[1].moveToError).toBeNull();
  });
});

describe('planReviewImport', () => {
  const setup = () => {
    const sessions = buildSessions();
    // Ann: A group 1 and B group 1. Bob and Cat fill A group 2 (max 2 -> full). Nobody in group 3.
    const assignments = [
      ...assignTo(sessions, 1, 'A', 1), ...assignTo(sessions, 1, 'B', 1),
      ...assignTo(sessions, 2, 'A', 2), ...assignTo(sessions, 3, 'A', 2)
    ];
    return { sessions, assignments };
  };

  test('rows with nothing in Move To are left alone and counted', () => {
    const { results, summary } = plan([fileRow(), fileRow({ 'Person ID (do not change)': 2, 'Move To Group': '' })], setup());
    expect(results).toEqual([]);
    expect(summary.unchanged).toBe(2);
  });

  test('a valid move is planned with the rows to remove and add', () => {
    const { results, summary } = plan([fileRow({ 'Move To Group': 'Group 3', 'Change Reason': 'Clash with leave' })], setup());
    expect(summary.ok).toBe(1);
    const [r] = results;
    expect(r).toMatchObject({ status: 'ok', person: 'Ann One', fromGroup: 1, toGroup: 3 });
    expect(r.plan.deleteIds).toHaveLength(2); // both parts of A group 1
    expect(r.plan.newRows).toHaveLength(2);   // both parts of A group 3
    expect(r.plan.newRows[0].notes).toMatch(/Moved from Group 1 to Group 3 on .* - Reason: Clash with leave/);
  });

  test('a person who has since been moved is reported as out of date, not moved again', () => {
    const { sessions, assignments } = setup();
    // Ann is now in group 3 of A, but the sheet says group 1
    const moved = assignments.filter((a) => !(a.end_user_id === 1 && a.course_id === 'A')).concat(assignTo(sessions, 1, 'A', 3));
    const { results } = plan([fileRow({ 'Move To Group': 2 })], { sessions, assignments: moved });
    expect(results[0].status).toBe('error');
    expect(results[0].message).toMatch(/Out of date: Ann One is no longer in Group 1 for Course A \(now in Group 3\)/);
  });

  test('a person no longer assigned to the course is reported as out of date', () => {
    const { sessions, assignments } = setup();
    const { results } = plan([fileRow({ 'Move To Group': 3 })], { sessions, assignments: assignments.filter((a) => !(a.end_user_id === 1 && a.course_id === 'A')) });
    expect(results[0].message).toMatch(/no longer assigned to Course A/);
  });

  test('a group that does not exist is refused, listing the valid ones', () => {
    const { results } = plan([fileRow({ 'Move To Group': 9 })], setup());
    expect(results[0]).toMatchObject({ status: 'error' });
    expect(results[0].message).toMatch(/no Group 9.*valid groups: 1, 2, 3/);
  });

  test('moving to the group they are already in changes nothing', () => {
    const { results, summary } = plan([fileRow({ 'Move To Group': 1 })], setup());
    expect(summary.skipped).toBe(1);
    expect(results[0].plan).toBeNull();
  });

  test('a full group is blocked unless the user allows it, then it is a warning', () => {
    const blocked = plan([fileRow({ 'Move To Group': 2 })], setup());
    expect(blocked.results[0].status).toBe('blocked');
    expect(blocked.results[0].message).toMatch(/full.*2\/2/);
    expect(blocked.results[0].plan).toBeNull();

    const allowed = plan([fileRow({ 'Move To Group': 2 })], { ...setup(), allowFull: true });
    expect(allowed.results[0].status).toBe('warning');
    expect(allowed.results[0].plan.newRows).toHaveLength(2);
  });

  test('seats are counted across the whole file: the third person into a 2-seat group is blocked', () => {
    const sessions = buildSessions();
    const assignments = [1, 2, 3].flatMap((id) => assignTo(sessions, id, 'A', 1));
    const rows = [1, 2, 3].map((id) => fileRow({ 'Person ID (do not change)': id, Person: `P${id}`, 'Move To Group': 3 }));
    const { results } = plan(rows, { sessions, assignments });
    expect(results.map((r) => r.status)).toEqual(['ok', 'ok', 'blocked']); // group 3 holds 2
  });

  test('freeing a seat earlier in the file makes it available to a later row', () => {
    const sessions = buildSessions();
    // group 2 of A is full (Bob, Cat); Ann is in group 1. Bob leaves group 2 first, then Ann takes the seat.
    const assignments = [...assignTo(sessions, 2, 'A', 2), ...assignTo(sessions, 3, 'A', 2), ...assignTo(sessions, 1, 'A', 1)];
    const rows = [
      fileRow({ 'Person ID (do not change)': 2, Person: 'Bob Two', 'Current Group': 'Group 2', 'Move To Group': 3 }),
      fileRow({ 'Person ID (do not change)': 1, Person: 'Ann One', 'Current Group': 'Group 1', 'Move To Group': 2 })
    ];
    const { results } = plan(rows, { sessions, assignments });
    expect(results.map((r) => r.status)).toEqual(['ok', 'ok']);
  });

  test('the same person and course twice in one file: only the first row counts', () => {
    const rows = [fileRow({ 'Move To Group': 3 }), fileRow({ 'Move To Group': 2 })];
    const { results } = plan(rows, setup());
    expect(results.map((r) => r.status)).toEqual(['ok', 'error']);
    expect(results[1].message).toMatch(/more than once/);
  });

  test('a stakeholder cannot change rows outside their locations or areas', () => {
    const outsideLocation = plan([fileRow({ 'Move To Group': 3 })], { ...setup(), filters: { locations: ['Manchester'] } });
    expect(outsideLocation.results[0].status).toBe('error');
    expect(outsideLocation.results[0].message).toMatch(/outside the locations or functional areas/);

    const outsideArea = plan([fileRow({ 'Move To Group': 3 })], { ...setup(), filters: { functionalAreas: ['Finance'] } });
    expect(outsideArea.results[0].status).toBe('error');

    const inside = plan([fileRow({ 'Move To Group': 3 })], { ...setup(), filters: { locations: [LOCATION], functionalAreas: [AREA] } });
    expect(inside.results[0].status).toBe('ok');
  });

  test('edited key columns are caught instead of guessed at', () => {
    const noId = plan([fileRow({ 'Move To Group': 3, 'Person ID (do not change)': '' })], setup());
    expect(noId.results[0].status).toBe('error');
    expect(noId.results[0].message).toMatch(/missing or has been changed/);

    const textId = plan([fileRow({ 'Move To Group': 3, 'Person ID (do not change)': 'Ann' })], setup());
    expect(textId.results[0].message).toMatch(/missing or has been changed/);

    const wrongPlace = plan([fileRow({ 'Move To Group': 3, 'Training Location': 'Atlantis' })], setup());
    expect(wrongPlace.results[0].message).toMatch(/does not exist at Atlantis/);
  });

  test('every planned move touches only that person\'s own rows', () => {
    const { sessions, assignments } = setup();
    const { results } = plan([fileRow({ 'Move To Group': 3 })], { sessions, assignments });
    const annsRows = new Set(assignments.filter((a) => a.end_user_id === 1 && a.course_id === 'A').map((a) => a.id));
    expect(new Set(results[0].plan.deleteIds)).toEqual(annsRows);
    expect(results[0].plan.newRows.every((r) => r.end_user_id === 1 && r.course_id === 'A')).toBe(true);
  });

  test('planning never changes the data it was given', () => {
    const { sessions, assignments } = setup();
    const before = JSON.stringify(assignments);
    plan([fileRow({ 'Move To Group': 3 })], { sessions, assignments });
    expect(JSON.stringify(assignments)).toBe(before);
  });
});

describe('scope lists', () => {
  test('a stakeholder with nothing assigned has no restriction (null), not an empty one', () => {
    expect(scopeList([])).toBeNull();
    expect(scopeList(null)).toBeNull();
    expect(scopeList(['London'])).toEqual(['London']);
  });

  test('combining keeps only what every list allows; no lists means no restriction', () => {
    expect(combineScopeLists(null, null)).toBeNull();
    expect(combineScopeLists(['London'], null)).toEqual(['London']);
    expect(combineScopeLists(['London', 'Leeds'], ['Leeds', 'Hull'])).toEqual(['Leeds']);
  });

  test('lists that share nothing allow NOTHING (they must never open everything up)', () => {
    const none = combineScopeLists(['London'], ['Leeds']);
    expect(none).toEqual([]);

    const sessions = buildSessions();
    const assignments = assignTo(sessions, 1, 'A', 1);
    expect(buildReviewModel({ sessions, assignments, directory, filters: { locations: none } }).rows).toEqual([]);

    const { results } = plan([fileRow({ 'Move To Group': 3 })], { sessions, assignments, filters: { locations: none } });
    expect(results[0].status).toBe('error');
  });
});

describe('outcomesToCsv', () => {
  test('writes a header and one line per row, escaping quotes, commas and line breaks', () => {
    const csv = outcomesToCsv([
      { rowNumber: 2, person: 'Ann "Annie" One', course: 'A, B', fromGroup: 1, toGroup: 2, applied: true, message: 'Moved' },
      { rowNumber: 3, person: 'Bob', course: 'C', fromGroup: 1, toGroup: 9, applied: false, message: 'No such group\nTry again' }
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Row,Person,Course,From Group,To Group,Result,Message');
    expect(lines[1]).toBe('2,"Ann ""Annie"" One","A, B",1,2,Applied,Moved');
    expect(csv).toContain('"No such group\nTry again"');
    expect(csv).toContain('Not applied');
  });

  test('no outcomes gives just the header', () => {
    expect(outcomesToCsv([])).toBe('Row,Person,Course,From Group,To Group,Result,Message');
  });
});
