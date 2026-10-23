// Pure rules for the Attendance Reports screen. No React, no database.

export const EMPTY_FILTERS = { startDate: '', endDate: '', functionalArea: '', trainingLocation: '' };

/** Sorted distinct non-empty values, for the filter dropdowns. */
export const uniqueOptions = (sessions, field) => [...new Set(sessions.map((session) => session[field]).filter(Boolean))].sort();

const dayOf = (value) => String(value || '').slice(0, 10);

/**
 * The sessions the filters leave in (so the By Session list matches the numbers on the Overview).
 * Dates are whole days: a session on the end date is included.
 */
export function filterReportSessions(sessions, filters) {
  return sessions.filter((session) => {
    if (filters.functionalArea && session.functional_area !== filters.functionalArea) return false;
    if (filters.trainingLocation && session.training_location !== filters.trainingLocation) return false;
    const day = dayOf(session.start_datetime);
    if (filters.startDate && day < filters.startDate) return false;
    if (filters.endDate && day > filters.endDate) return false;
    return true;
  });
}

/**
 * A person's numbers from their attendance history (records with a status): present counts as attended,
 * every other status as missed.
 */
export function summariseHistory(history) {
  const total = history.length;
  const attended = history.filter((record) => record.status?.is_present).length;
  return { total, attended, missed: total - attended, rate: total > 0 ? Math.round((attended / total) * 100) : 0 };
}

/** The ways the Overview can break attendance down: the label, and where the numbers are in the statistics. */
export const GROUPINGS = [
  { value: 'functional_area', label: 'Functional Area', key: 'by_functional_area' },
  { value: 'training_location', label: 'Training Location', key: 'by_training_location' },
  { value: 'course', label: 'Course', key: 'by_course' }
];

const entriesOf = (statistics, grouping) => {
  const key = GROUPINGS.find((g) => g.value === grouping)?.key;
  return key && statistics?.[key] ? Object.entries(statistics[key]) : [];
};

/** The cards to show for a grouping: [[name, { total, present, attendance_rate }], ...]. */
export const groupEntries = entriesOf;

/**
 * Which breakdown to open on: functional area as usual, unless there is only one area (or none) and another
 * breakdown has more than one entry, in which case the first such one, so the page is not a single card.
 */
export function defaultGrouping(statistics) {
  if (entriesOf(statistics, 'functional_area').length > 1) return 'functional_area';
  const better = GROUPINGS.find((g) => entriesOf(statistics, g.value).length > 1);
  return better ? better.value : 'functional_area';
}
