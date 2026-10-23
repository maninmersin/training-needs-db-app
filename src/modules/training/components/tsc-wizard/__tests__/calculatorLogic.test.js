import { DEFAULT_CRITERIA, applyCriteriaChange, calculate, calculateSessions, groupUsers, toExportRows } from '../calculatorLogic';

const row = (user, course, hours, location = 'Dubai', area = 'Finance') => ({ end_user_id: user, course_id: course, duration_hrs: hours, training_location: location, functional_area: area });

describe('groupUsers', () => {
  test('groups by location and area; a course counts once per person', () => {
    const groups = groupUsers([row(1, 'c1', 3), row(1, 'c1', 3), row(1, 'c2', 4), row(2, 'c1', 3), row(3, 'c1', 3, 'Leeds')]);
    expect(groups).toHaveLength(2);
    const dubai = groups.find((g) => g.training_location === 'Dubai');
    expect(dubai.users.size).toBe(2);
    expect([...dubai.users.get(1).values()]).toEqual([3, 4]);
  });
});

describe('calculateSessions', () => {
  test('classrooms needed = hours x contingency / (weeks x days x hours a day x attendees)', () => {
    const criteria = { max_attendees: 10, total_weeks: 4, daily_hours: 8, days_per_week: 5, contingency: 1.2 };
    // 160 classroom hours, 1,600 user-hours. 2 people x 2 courses x 5h = 20h, x1.2 = 24h
    const [result] = calculate([row(1, 'a', 5), row(1, 'b', 5), row(2, 'a', 5), row(2, 'b', 5)], criteria);
    expect(result).toMatchObject({ uniqueUserCount: 2, totalTrainingHours: 24, totalClassroomHoursAvailable: 160, userHoursPerClassroom: 1600 });
    expect(result.numberOfClassrooms).toBeCloseTo(0.015, 5);
  });

  test('no capacity means 0 classrooms, not infinity; no rows or no seats gives nothing', () => {
    const [result] = calculateSessions(groupUsers([row(1, 'a', 5)]), { ...DEFAULT_CRITERIA, days_per_week: 0 });
    expect(result.numberOfClassrooms).toBe(0);
    expect(calculate([], DEFAULT_CRITERIA)).toEqual([]);
    expect(calculate([row(1, 'a', 5)], { ...DEFAULT_CRITERIA, max_attendees: 0 })).toEqual([]);
  });

  test('text durations are read as numbers and missing ones as 0', () => {
    const [result] = calculate([row(1, 'a', '3'), row(1, 'b', null)], { ...DEFAULT_CRITERIA, contingency: 1 });
    expect(result.totalTrainingHours).toBe(3);
  });
});

describe('criteria and export', () => {
  test('only valid values are accepted', () => {
    const c = DEFAULT_CRITERIA;
    expect(applyCriteriaChange(c, 'total_weeks', 6).total_weeks).toBe(6);
    expect(applyCriteriaChange(c, 'total_weeks', 0)).toBe(c);
    expect(applyCriteriaChange(c, 'days_per_week', 8)).toBe(c);
    expect(applyCriteriaChange(c, 'days_per_week', 2.5)).toBe(c);
    expect(applyCriteriaChange(c, 'contingency', 0.9)).toBe(c);
    expect(applyCriteriaChange(c, 'contingency', 1.5).contingency).toBe(1.5);
  });

  test('export rows round the classrooms to 2 decimals', () => {
    const [exported] = toExportRows([{ training_location: 'Dubai', functional_area: 'Finance', uniqueUserCount: 2, totalTrainingHours: 24, totalClassroomHoursAvailable: 160, numberOfClassrooms: 1.23456 }]);
    expect(exported).toEqual(['Dubai', 'Finance', 2, 24, 160, 1.23]);
  });
});
