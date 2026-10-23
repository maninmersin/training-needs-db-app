import { EMPTY_STATISTICS, groupAttendance } from '../attendanceGroups';

const row = (location, present, extra = {}) => ({ attendance_statuses: { is_present: present }, training_sessions: { training_location: location, ...extra } });
const byLocation = (rows) => groupAttendance(rows, (r) => r.training_sessions.training_location);

describe('groupAttendance', () => {
  test('counts records, those present and the rate for each group', () => {
    const groups = byLocation([row('London', true), row('London', false), row('London', true), row('Leeds', true)]);
    expect(groups.London).toEqual({ total: 3, present: 2, attendance_rate: (2 / 3) * 100 });
    expect(groups.Leeds).toEqual({ total: 1, present: 1, attendance_rate: 100 });
  });

  test('groups come out in alphabetical order, with numbers in numeric order', () => {
    expect(Object.keys(byLocation([row('Manchester', true), row('Leeds', true), row('London', true)]))).toEqual(['Leeds', 'London', 'Manchester']);
    expect(Object.keys(groupAttendance([row('Room 10', true), row('Room 2', true)], (r) => r.training_sessions.training_location))).toEqual(['Room 2', 'Room 10']);
  });

  test('a missing or blank value is grouped as "Not set" rather than "null" or "undefined"', () => {
    const groups = byLocation([row(null, true), row('', false), row(undefined, true), row('  ', true)]);
    expect(Object.keys(groups)).toEqual(['Not set']);
    expect(groups['Not set'].total).toBe(4);
  });

  test('an absent record counts in the total but not as present', () => {
    expect(byLocation([row('London', false)]).London).toEqual({ total: 1, present: 0, attendance_rate: 0 });
  });

  test('no records gives no groups', () => {
    expect(byLocation([])).toEqual({});
  });

  test('the same records can be grouped several ways', () => {
    const rows = [row('London', true, { course_name: 'Ledger' }), row('Leeds', true, { course_name: 'Ledger' }), row('Leeds', false, { course_name: 'Stock' })];
    expect(Object.keys(groupAttendance(rows, (r) => r.training_sessions.course_name))).toEqual(['Ledger', 'Stock']);
    expect(groupAttendance(rows, (r) => r.training_sessions.course_name).Ledger.total).toBe(2);
  });
});

test('the empty statistics have the same shape as real ones, with every breakdown present', () => {
  expect(Object.keys(EMPTY_STATISTICS).sort()).toEqual(['by_course', 'by_functional_area', 'by_training_location', 'overall']);
  expect(EMPTY_STATISTICS.overall).toEqual({ total_records: 0, total_present: 0, total_absent: 0, attendance_rate: 0 });
});
