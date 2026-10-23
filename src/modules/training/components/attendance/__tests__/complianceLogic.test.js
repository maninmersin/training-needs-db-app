import { buildDateFilters, complianceLevel, drillInto, formatPercentage, goToBreadcrumb } from '../complianceLogic';

// Wednesday 14 October 2026, mid-afternoon
const NOW = new Date(2026, 9, 14, 15, 0);

describe('buildDateFilters', () => {
  test('all time has no limits', () => {
    expect(buildDateFilters({ preset: 'all', startDate: '', endDate: '' }, NOW)).toEqual({});
  });

  test('this week runs Sunday to Saturday around today', () => {
    expect(buildDateFilters({ preset: 'week1' }, NOW)).toEqual({ startDate: '2026-10-11', endDate: '2026-10-17' });
  });

  test('last week is the seven days before that', () => {
    expect(buildDateFilters({ preset: 'week2' }, NOW)).toEqual({ startDate: '2026-10-04', endDate: '2026-10-10' });
  });

  test('a week that crosses a month and year end is handled', () => {
    expect(buildDateFilters({ preset: 'week1' }, new Date(2026, 0, 1))).toEqual({ startDate: '2025-12-28', endDate: '2026-01-03' });
  });

  test('this month runs from the 1st to the last day', () => {
    expect(buildDateFilters({ preset: 'month' }, NOW)).toEqual({ startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(buildDateFilters({ preset: 'month' }, new Date(2028, 1, 10))).toEqual({ startDate: '2028-02-01', endDate: '2028-02-29' });
  });

  test('the date is the person\'s own date, even just after midnight', () => {
    expect(buildDateFilters({ preset: 'week1' }, new Date(2026, 9, 11, 0, 30))).toEqual({ startDate: '2026-10-11', endDate: '2026-10-17' });
  });

  test('a custom range uses only the dates that were filled in', () => {
    expect(buildDateFilters({ preset: 'custom', startDate: '2026-10-01', endDate: '' }, NOW)).toEqual({ startDate: '2026-10-01' });
    expect(buildDateFilters({ preset: 'custom', startDate: '', endDate: '2026-10-31' }, NOW)).toEqual({ endDate: '2026-10-31' });
    expect(buildDateFilters({ preset: 'custom', startDate: '', endDate: '' }, NOW)).toEqual({});
  });
});

describe('complianceLevel', () => {
  test.each([
    [100, 'excellent', 'Excellent'],
    [90, 'excellent', 'Excellent'],
    [89.9, 'good', 'Good'],
    [75, 'good', 'Good'],
    [74, 'warning', 'Needs Attention'],
    [60, 'warning', 'Needs Attention'],
    [59.9, 'critical', 'Critical'],
    [0, 'critical', 'Critical']
  ])('%s%% is %s', (rate, level, label) => {
    expect(complianceLevel(rate)).toEqual({ level, label });
  });

  test('percentages are rounded', () => {
    expect(formatPercentage(66.6)).toBe('67%');
    expect(formatPercentage(0)).toBe('0%');
  });
});

describe('drill-down', () => {
  test('clicking a functional area, then a location, then a session goes one level deeper each time', () => {
    const area = drillInto({}, 'project', 'Finance');
    expect(area).toEqual({ path: { functionalArea: 'Finance' }, viewLevel: 'functionalArea' });
    const location = drillInto(area.path, 'functionalArea', 'London');
    expect(location).toEqual({ path: { functionalArea: 'Finance', trainingLocation: 'London' }, viewLevel: 'trainingLocation' });
    expect(drillInto(location.path, 'trainingLocation', 'session-1')).toEqual({ path: location.path, viewLevel: 'session' });
  });

  test('the breadcrumb goes back to an area, a location, or the whole project', () => {
    const path = { functionalArea: 'Finance', trainingLocation: 'London' };
    expect(goToBreadcrumb(path, 'functionalArea', 'Finance')).toEqual({ path: { functionalArea: 'Finance' }, viewLevel: 'functionalArea' });
    expect(goToBreadcrumb(path, 'trainingLocation', 'London')).toEqual({ path, viewLevel: 'trainingLocation' });
    expect(goToBreadcrumb(path, 'project')).toEqual({ path: {}, viewLevel: 'project' });
  });

  test('a location crumb with no area chosen goes back to the project', () => {
    expect(goToBreadcrumb({}, 'trainingLocation', 'London')).toEqual({ path: {}, viewLevel: 'project' });
  });
});
