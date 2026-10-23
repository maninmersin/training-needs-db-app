import { filterAttendees, filterSessions, sessionLabel } from '../trackerLogic';

const STATUSES = [
  { id: 1, status_name: 'Present', is_present: true },
  { id: 2, status_name: 'Absent', is_present: false },
  { id: 3, status_name: 'Late', is_present: true }
];
const person = (id, name, email) => ({ id: `a${id}`, attendee_id: id, user: { name, email } });
const ATTENDEES = [person(1, 'Amelia Brown', 'amelia@x.com'), person(2, 'Oliver Patel', 'oliver@x.com'), person(3, 'Isla Walker', null), { id: 'a4', attendee_id: 4, user: null }];
const RECORDS = [{ attendee_id: 1, attendance_status_id: 1 }, { attendee_id: 2, attendance_status_id: 2 }];
const ids = (list) => list.map((a) => a.attendee_id);

describe('filterSessions', () => {
  const sessions = [
    { course_name: 'Ledger Basics', training_location: 'London', functional_area: 'Finance' },
    { course_name: 'Stock Counts', training_location: 'Leeds', functional_area: null }
  ];
  test('matches course, location or area, ignoring case; blank keeps all', () => {
    expect(filterSessions(sessions, 'LEDGER')).toHaveLength(1);
    expect(filterSessions(sessions, 'leeds')).toHaveLength(1);
    expect(filterSessions(sessions, 'finance')).toHaveLength(1);
    expect(filterSessions(sessions, '  ')).toHaveLength(2);
    expect(filterSessions(sessions, 'zzz')).toEqual([]);
  });
});

describe('filterAttendees', () => {
  test('people we have no details for are never shown', () => {
    expect(ids(filterAttendees(ATTENDEES, RECORDS, STATUSES, '', 'all'))).toEqual([1, 2, 3]);
  });

  test('search matches name or email and copes with a missing email', () => {
    expect(ids(filterAttendees(ATTENDEES, RECORDS, STATUSES, 'PATEL', 'all'))).toEqual([2]);
    expect(ids(filterAttendees(ATTENDEES, RECORDS, STATUSES, 'amelia@', 'all'))).toEqual([1]);
    expect(ids(filterAttendees(ATTENDEES, RECORDS, STATUSES, 'walker', 'all'))).toEqual([3]);
  });

  test('status filters: not marked, present, absent', () => {
    expect(ids(filterAttendees(ATTENDEES, RECORDS, STATUSES, '', 'unmarked'))).toEqual([3]);
    expect(ids(filterAttendees(ATTENDEES, RECORDS, STATUSES, '', 'present'))).toEqual([1]);
    expect(ids(filterAttendees(ATTENDEES, RECORDS, STATUSES, '', 'absent'))).toEqual([2]);
  });

  test('"Late" counts as present, and search and status combine', () => {
    const records = [...RECORDS, { attendee_id: 3, attendance_status_id: 3 }];
    expect(ids(filterAttendees(ATTENDEES, records, STATUSES, '', 'present'))).toEqual([1, 3]);
    expect(ids(filterAttendees(ATTENDEES, records, STATUSES, 'isla', 'present'))).toEqual([3]);
  });
});

test('a session label has the course, date and location', () => {
  const label = sessionLabel({ course_name: 'Ledger', start_datetime: '2026-10-12T09:30:00', training_location: 'London' });
  expect(label).toMatch(/^Ledger - .*2026.* - London$/);
});

describe('walk-ins', () => {
  const { withWalkIns, defaultWalkInStatus, addableWalkIns } = require('../trackerLogic');
  const assigned = [{ id: 'a1', attendee_id: 1, user: { name: 'Amelia' } }];

  test('people with a record who were not assigned are added as flagged rows after the assigned people', () => {
    const records = [
      { attendee_id: 1, user: { name: 'Amelia' } },
      { attendee_id: 9, user: { name: 'Walk In' } }
    ];
    const rows = withWalkIns(assigned, records);
    expect(rows.map((r) => [r.attendee_id, Boolean(r.walkIn)])).toEqual([[1, false], [9, true]]);
    expect(rows[1]).toMatchObject({ id: 'walk-in-9', user: { name: 'Walk In' } });
  });

  test('a record we have no person details for is not shown, and no records means no change', () => {
    expect(withWalkIns(assigned, [{ attendee_id: 9, user: null }])).toHaveLength(1);
    expect(withWalkIns(assigned, [])).toEqual(assigned);
  });

  test('a walk-in starts as the first "present" status, else the first status, else none', () => {
    expect(defaultWalkInStatus([{ id: 1, is_present: false }, { id: 2, is_present: true }, { id: 3, is_present: true }]).id).toBe(2);
    expect(defaultWalkInStatus([{ id: 1, is_present: false }]).id).toBe(1);
    expect(defaultWalkInStatus([])).toBeNull();
  });

  test('search results exclude people already on the list', () => {
    const people = [{ id: 1 }, { id: 2 }, { id: 9 }];
    const rows = [{ attendee_id: 1 }, { attendee_id: 9 }];
    expect(addableWalkIns(people, rows).map((p) => p.id)).toEqual([2]);
  });
});
