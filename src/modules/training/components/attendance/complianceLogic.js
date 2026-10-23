// Pure rules for the Attendance Compliance dashboard: date ranges, colour bands and drill-down. No React, no database.

const pad = (n) => String(n).padStart(2, '0');
/** 'YYYY-MM-DD' in the person's own calendar (not UTC, which could show yesterday's date late at night). */
const dateText = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Sunday to Saturday week, `weeksAgo` weeks back from the week containing `now`. */
function weekRange(now, weeksAgo) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 7 * weeksAgo);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { startDate: dateText(start), endDate: dateText(end) };
}

/**
 * The start and end dates the data should be limited to.
 * @param {{ preset: 'all'|'week1'|'week2'|'month'|'custom', startDate: string, endDate: string }} dateRange
 * @param {Date} [now]
 */
export function buildDateFilters(dateRange, now = new Date()) {
  const { preset, startDate, endDate } = dateRange;
  if (preset === 'custom') {
    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    return filters;
  }
  if (preset === 'week1') return weekRange(now, 0);
  if (preset === 'week2') return weekRange(now, 1);
  if (preset === 'month') {
    return {
      startDate: dateText(new Date(now.getFullYear(), now.getMonth(), 1)),
      endDate: dateText(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    };
  }
  return {};
}

export const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'week1', label: 'This Week' },
  { value: 'week2', label: 'Last Week' },
  { value: 'month', label: 'This Month' }
];

/** The colour band for a compliance percentage. */
export function complianceLevel(rate) {
  if (rate >= 90) return { level: 'excellent', label: 'Excellent' };
  if (rate >= 75) return { level: 'good', label: 'Good' };
  if (rate >= 60) return { level: 'warning', label: 'Needs Attention' };
  return { level: 'critical', label: 'Critical' };
}

export const formatPercentage = (value) => `${Math.round(value)}%`;

/** What the grid is showing at each level of the drill-down. */
export const LEVEL_TITLES = { project: 'By Functional Area', functionalArea: 'By Training Location', trainingLocation: 'By Session' };

/** Clicking a card: the path and level to move to. A session is the deepest level and leaves the path alone. */
export function drillInto(currentPath, viewLevel, key) {
  if (viewLevel === 'project') return { path: { ...currentPath, functionalArea: key }, viewLevel: 'functionalArea' };
  if (viewLevel === 'functionalArea') return { path: { ...currentPath, trainingLocation: key }, viewLevel: 'trainingLocation' };
  return { path: { ...currentPath }, viewLevel: 'session' };
}

/** Clicking a breadcrumb: back up to that level (anything else goes back to the whole project). */
export function goToBreadcrumb(currentPath, level, value = null) {
  if (level === 'functionalArea' && value) return { path: { functionalArea: value }, viewLevel: 'functionalArea' };
  if (level === 'trainingLocation' && value && currentPath.functionalArea) {
    return { path: { functionalArea: currentPath.functionalArea, trainingLocation: value }, viewLevel: 'trainingLocation' };
  }
  return { path: {}, viewLevel: 'project' };
}
