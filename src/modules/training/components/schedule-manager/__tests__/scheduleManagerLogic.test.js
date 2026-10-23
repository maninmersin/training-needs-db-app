import { deleteSummary, filterSchedules, groupSessionsForEditor, sessionCountOf } from '../scheduleManagerLogic';

describe('sessionCountOf', () => {
  test('uses the count from the list query, else the loaded sessions, else 0', () => {
    expect(sessionCountOf({ session_count: [{ count: 7 }] })).toBe(7);
    expect(sessionCountOf({ session_count: [], sessions: [1, 2] })).toBe(2);
    expect(sessionCountOf({ sessions: { Finance: {} } })).toBe(0);
    expect(sessionCountOf({})).toBe(0);
  });
});

describe('filterSchedules', () => {
  const schedules = [
    { name: 'Wave One', created_at: '2026-10-01T09:00:00Z' },
    { name: 'wave two', created_at: '2026-10-02T09:00:00Z' },
    { name: 'Pilot', created_at: '2026-10-02T11:00:00Z' }
  ];
  test('by name ignoring case, by created day, and both', () => {
    expect(filterSchedules(schedules, 'WAVE', '').map((s) => s.name)).toEqual(['Wave One', 'wave two']);
    expect(filterSchedules(schedules, '', '2026-10-02').map((s) => s.name)).toEqual(['wave two', 'Pilot']);
    expect(filterSchedules(schedules, 'wave', '2026-10-02').map((s) => s.name)).toEqual(['wave two']);
    expect(filterSchedules(schedules, '', '')).toHaveLength(3);
  });
});

test('deleteSummary pluralises', () => {
  expect(deleteSummary(1)).toBe('1 schedule');
  expect(deleteSummary(3)).toBe('3 schedules');
});

describe('groupSessionsForEditor', () => {
  const session = (id, extra = {}) => ({
    id, course_id: 'c1', course_name: 'Course One', session_number: 1, functional_area: 'Finance', training_location: 'Dubai Office', classroom_number: 2,
    start_datetime: '2026-10-05T09:30:00', end_datetime: '2026-10-05T12:30:00', duration_hours: 3, instructor_id: 't1', instructor_name: 'Tess', ...extra
  });

  test('groups by area, location and classroom, keeping the database id as event_id', () => {
    const grouped = groupSessionsForEditor([session('s1'), session('s2', { classroom_number: 3 }), session('s3', { functional_area: 'HR' })]);
    expect(Object.keys(grouped)).toEqual(['Finance', 'HR']);
    expect(Object.keys(grouped.Finance['Dubai Office'])).toEqual(['Classroom 2', 'Classroom 3']);
    const first = grouped.Finance['Dubai Office']['Classroom 2'][0];
    expect(first).toMatchObject({ event_id: 's1', trainer_id: 't1', trainer_name: 'Tess', title: 'Course One - Group 1', location: 'Dubai Office', duration: 3 });
    expect(first.eventId).toBe('c1-session1-dubai-office-finance');
  });

  test('keeps wall-clock times and defaults missing fields', () => {
    const grouped = groupSessionsForEditor([session('s1', { instructor_id: null, session_title: 'Custom', total_parts: null })]);
    const s = grouped.Finance['Dubai Office']['Classroom 2'][0];
    expect(s.start.getHours()).toBe(9);
    expect(s.start.getMinutes()).toBe(30);
    expect(s).toMatchObject({ trainer_id: '', title: 'Custom', custom_title: 'Custom', totalParts: 1, isMultiDay: false });
  });

  test('no sessions gives an empty structure', () => {
    expect(groupSessionsForEditor(null)).toEqual({});
  });
});
