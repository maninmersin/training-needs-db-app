import {
  allSelected, applyChange, buildEndUsers, calculationNote, classroomSuggestions, defaultCriteria, groupByLocation, hasCapacityWarnings,
  scopeErrors, scopeIsValid, toggleAll, toggleDay, toggleItem
} from '../criteriaLogic';

describe('defaults', () => {
  test('start today, Monday to Friday, both AM and PM, nothing selected', () => {
    const d = defaultCriteria(new Date('2026-10-23T12:00:00Z'));
    expect(d.start_date).toBe('2026-10-23');
    expect(d.scheduling_days).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    expect(d.scheduling_preference).toBe('both');
    expect(d.selected_functional_areas).toEqual([]);
    expect(d.selected_training_locations).toEqual([]);
  });
});

describe('applyChange', () => {
  const base = defaultCriteria();
  test('an ordinary field changes only that field', () => {
    expect(applyChange(base, 'total_weeks', 8)).toEqual({ ...base, total_weeks: 8 });
  });
  test('morning only clears the afternoon times, afternoon only clears the morning times', () => {
    const am = applyChange(base, 'scheduling_preference', 'am_only');
    expect([am.start_time_pm, am.end_time_pm, am.start_time_am]).toEqual(['', '', '09:30']);
    const pm = applyChange(base, 'scheduling_preference', 'pm_only');
    expect([pm.start_time_am, pm.end_time_am, pm.start_time_pm]).toEqual(['', '', '13:30']);
  });
  test('back to both restores missing times but keeps ones already set', () => {
    const am = applyChange(base, 'scheduling_preference', 'am_only');
    const both = applyChange({ ...am, start_time_am: '08:00' }, 'scheduling_preference', 'both');
    expect(both.start_time_am).toBe('08:00');
    expect(both.end_time_am).toBe('12:30');
    expect([both.start_time_pm, both.end_time_pm]).toEqual(['13:30', '16:30']);
  });
});

describe('ticking', () => {
  test('toggleItem adds and removes without duplicates', () => {
    expect(toggleItem(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(toggleItem(['a', 'b'], 'b', true)).toEqual(['a', 'b']);
    expect(toggleItem(['a', 'b'], 'a', false)).toEqual(['b']);
  });
  test('"All" selects everything or nothing, and is only ticked when all are chosen', () => {
    expect(toggleAll(['a', 'b'], true)).toEqual(['a', 'b']);
    expect(toggleAll(['a', 'b'], false)).toEqual([]);
    expect(allSelected(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(allSelected(['a'], ['a', 'b'])).toBe(false);
    expect(allSelected([], [])).toBe(false);
  });
  test('days toggle on and off', () => {
    expect(toggleDay(['Monday'], 'Tuesday')).toEqual(['Monday', 'Tuesday']);
    expect(toggleDay(['Monday', 'Tuesday'], 'Monday')).toEqual(['Tuesday']);
  });
});

describe('scope validation', () => {
  test('needs at least one area and one location', () => {
    expect(scopeErrors({ selected_functional_areas: [], selected_training_locations: ['L'] })).toEqual({ functional_areas: true, training_locations: false });
    expect(scopeIsValid({ selected_functional_areas: ['A'], selected_training_locations: [] })).toBe(false);
    expect(scopeIsValid({ selected_functional_areas: ['A'], selected_training_locations: ['L'] })).toBe(true);
  });
});

describe('buildEndUsers', () => {
  const row = (user, course, location, area, extra = {}) => ({
    user_id: user, user_name: `U${user}`, user_email: `${user}@x.com`, training_location: location, user_project_role: 'R', course_id: course,
    course_name: `C${course}`, functional_area: area, duration_hrs: 2, course_priority: 1, ...extra
  });
  const rows = [row(1, 'c1', 'Dubai', 'Finance'), row(1, 'c1', 'Dubai', 'Finance'), row(2, 'c1', 'Dubai', 'Finance'), row(3, 'c2', 'Leeds', 'Finance'), row(4, 'c3', 'Dubai', 'HR')];

  test('keeps only the chosen locations and areas, and repeated person + course pairs once', () => {
    const { endUsers, peopleCount, courseCount } = buildEndUsers(rows, { selected_training_locations: ['Dubai'], selected_functional_areas: ['Finance'] });
    expect(endUsers.map((u) => u.unique_key)).toEqual(['1-c1', '2-c1']);
    expect(peopleCount).toBe(2);
    expect(courseCount).toBe(1);
  });

  test('shapes each row the way the scheduler expects', () => {
    const { endUsers } = buildEndUsers([row(7, 'c9', 'Dubai', 'HR', { course_priority: 3 })], { selected_training_locations: ['Dubai'], selected_functional_areas: ['HR'] });
    expect(endUsers[0]).toMatchObject({ id: 7, name: 'U7', email: '7@x.com', course_id: 'c9', priority: 3, training_location: 'Dubai', functional_area: 'HR' });
  });

  test('nothing chosen gives nothing', () => {
    expect(buildEndUsers(rows, { selected_training_locations: [], selected_functional_areas: [] })).toEqual({ endUsers: [], peopleCount: 0, courseCount: 0 });
  });
});

describe('classroom estimate helpers', () => {
  test('groups people and hours by location', () => {
    const result = groupByLocation([
      { id: 1, training_location: 'A', duration_hrs: '2' },
      { id: 1, training_location: 'A', duration_hrs: 3 },
      { id: 2, training_location: 'B', duration_hrs: null }
    ]);
    expect(result).toEqual([{ location: 'A', users: 1, totalTrainingHours: 5 }, { location: 'B', users: 1, totalTrainingHours: 0 }]);
  });

  test('the note names the settings and any contingency', () => {
    const v = { ...defaultCriteria(), contingency: 1.2 };
    expect(calculationNote(v)).toBe('Based on 10 max attendees, 5 weeks, 5 days/week, 6 hours/day, with 20% contingency');
    expect(calculationNote({ ...v, contingency: 1 })).toBe('Based on 10 max attendees, 5 weeks, 5 days/week, 6 hours/day');
  });

  test('suggestions grow with the number of classrooms; warnings come from severity', () => {
    const req = (n, severity = 'ok') => ({ numberOfClassrooms: n, validation: { severity } });
    expect(classroomSuggestions([req(3)])).toEqual([]);
    expect(classroomSuggestions([req(6)])).toHaveLength(1);
    expect(classroomSuggestions([req(12)])).toHaveLength(2);
    expect(hasCapacityWarnings([req(1), req(6, 'warning')])).toBe(true);
    expect(hasCapacityWarnings([req(1)])).toBe(false);
  });
});
