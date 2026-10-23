// Pure figures for the "Select Training Schedule" list.

/** Counts and names from a schedule's sessions and its session-level assignments. */
export function scheduleStatsFrom(sessions, assignments) {
  const rows = sessions || [];
  const assignedSessions = new Set((assignments || []).map((assignment) => assignment.session_identifier)).size;
  const totalSessions = rows.length;
  const locationNames = [...new Set(rows.map((session) => session.training_location))];
  const functionalAreaNames = [...new Set(rows.map((session) => session.functional_area))];
  return {
    uniqueCourses: new Set(rows.map((session) => session.course_name || session.course_id)).size,
    totalSessions,
    locations: locationNames.length,
    functionalAreas: functionalAreaNames.length,
    locationNames,
    functionalAreaNames,
    assignedSessions,
    assignmentPercentage: totalSessions > 0 ? Math.round((assignedSessions / totalSessions) * 100) : 0
  };
}

/** How far through assigning a schedule is: 'complete', 'partial' or 'empty'. */
export function progressState(percentage) {
  if (percentage === 100) return 'complete';
  return percentage > 0 ? 'partial' : 'empty';
}
