import { EMPTY_FILTERS, filterReportSessions, summariseHistory, uniqueOptions } from '../reportsLogic';
import { endOfDay } from '../../../services/dateFilters';

const SESSIONS = [
  { id: 's1', functional_area: 'Finance', training_location: 'London', start_datetime: '2026-10-12T09:30:00' },
  { id: 's2', functional_area: 'HR', training_location: 'Leeds', start_datetime: '2026-10-14T13:30:00' },
  { id: 's3', functional_area: 'Finance', training_location: 'Leeds', start_datetime: '2026-10-17T09:30:00' },
  { id: 's4', functional_area: null, training_location: 'London', start_datetime: '2026-10-20T09:30:00' }
];
const ids = (list) => list.map((s) => s.id);

describe('uniqueOptions', () => {
  test('sorted, distinct and without blanks', () => {
    expect(uniqueOptions(SESSIONS, 'functional_area')).toEqual(['Finance', 'HR']);
    expect(uniqueOptions(SESSIONS, 'training_location')).toEqual(['Leeds', 'London']);
  });
});

describe('filterReportSessions', () => {
  test('no filters keeps every session', () => {
    expect(filterReportSessions(SESSIONS, EMPTY_FILTERS)).toHaveLength(4);
  });

  test('area and location', () => {
    expect(ids(filterReportSessions(SESSIONS, { ...EMPTY_FILTERS, functionalArea: 'Finance' }))).toEqual(['s1', 's3']);
    expect(ids(filterReportSessions(SESSIONS, { ...EMPTY_FILTERS, trainingLocation: 'Leeds' }))).toEqual(['s2', 's3']);
    expect(ids(filterReportSessions(SESSIONS, { ...EMPTY_FILTERS, functionalArea: 'Finance', trainingLocation: 'Leeds' }))).toEqual(['s3']);
  });

  test('dates are whole days: a session on the end date or the start date is included', () => {
    expect(ids(filterReportSessions(SESSIONS, { ...EMPTY_FILTERS, startDate: '2026-10-14', endDate: '2026-10-17' }))).toEqual(['s2', 's3']);
    expect(ids(filterReportSessions(SESSIONS, { ...EMPTY_FILTERS, endDate: '2026-10-12' }))).toEqual(['s1']);
  });
});

describe('summariseHistory', () => {
  const rec = (present) => ({ status: { is_present: present } });

  test('present counts as attended, every other status as missed', () => {
    expect(summariseHistory([rec(true), rec(true), rec(false), rec(true)])).toEqual({ total: 4, attended: 3, missed: 1, rate: 75 });
  });

  test('no history gives zeros rather than dividing by zero, and a record without a status counts as missed', () => {
    expect(summariseHistory([])).toEqual({ total: 0, attended: 0, missed: 0, rate: 0 });
    expect(summariseHistory([{ status: null }])).toMatchObject({ attended: 0, missed: 1 });
  });
});

describe('endOfDay', () => {
  test('a plain date means the whole day', () => {
    expect(endOfDay('2026-10-17')).toBe('2026-10-17T23:59:59');
  });

  test('anything else is left alone', () => {
    expect(endOfDay('2026-10-17T10:00:00')).toBe('2026-10-17T10:00:00');
    expect(endOfDay('')).toBe('');
    expect(endOfDay(undefined)).toBeUndefined();
  });
});

describe('breakdowns', () => {
  const { GROUPINGS, defaultGrouping, groupEntries } = require('../reportsLogic');
  const stats = (areas, locations, courses) => ({
    by_functional_area: Object.fromEntries(areas.map((a) => [a, { total: 1, present: 1, attendance_rate: 100 }])),
    by_training_location: Object.fromEntries(locations.map((a) => [a, { total: 1, present: 1, attendance_rate: 100 }])),
    by_course: Object.fromEntries(courses.map((a) => [a, { total: 1, present: 1, attendance_rate: 100 }]))
  });

  test('offers functional area, training location and course', () => {
    expect(GROUPINGS.map((g) => g.value)).toEqual(['functional_area', 'training_location', 'course']);
  });

  test('gives the entries of the chosen breakdown, and nothing for missing data', () => {
    const s = stats(['Finance', 'HR'], ['London'], ['Ledger']);
    expect(groupEntries(s, 'functional_area').map(([name]) => name)).toEqual(['Finance', 'HR']);
    expect(groupEntries(s, 'course').map(([name]) => name)).toEqual(['Ledger']);
    expect(groupEntries(null, 'course')).toEqual([]);
    expect(groupEntries({}, 'training_location')).toEqual([]);
    expect(groupEntries(s, 'bogus')).toEqual([]);
  });

  test('opens on functional area when there is more than one', () => {
    expect(defaultGrouping(stats(['Finance', 'HR'], ['London', 'Leeds'], ['A', 'B']))).toBe('functional_area');
  });

  test('with only one functional area it opens on the first breakdown that has more than one entry', () => {
    expect(defaultGrouping(stats(['Supply Chain'], ['London', 'Manchester'], ['A', 'B', 'C']))).toBe('training_location');
    expect(defaultGrouping(stats(['Supply Chain'], ['London'], ['A', 'B', 'C']))).toBe('course');
  });

  test('with nothing to split anywhere, or no data, it stays on functional area', () => {
    expect(defaultGrouping(stats(['Supply Chain'], ['London'], ['A']))).toBe('functional_area');
    expect(defaultGrouping(null)).toBe('functional_area');
  });
});
