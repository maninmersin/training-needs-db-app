// Pure figures for the Assignment Statistics dialog: who needs courses from this schedule, and how many of
// those courses they have been given a session for.

/** Every session in a schedule's nested structure (area > location > classroom > [sessions]) or a plain list. */
export function flattenSessions(sessions) {
  if (!sessions) return [];
  if (Array.isArray(sessions)) return sessions;
  if (typeof sessions === 'object') return Object.values(sessions).flatMap(flattenSessions);
  return [];
}

/** The ids of the courses that have a session in this schedule, as text. */
export function scheduleCourseIdsOf(sessions) {
  const ids = flattenSessions(sessions).map((session) => {
    const id = session.course_id ?? session.courseId ?? session.course?.course_id ?? session.course?.id;
    return id === undefined || id === null ? null : String(id);
  });
  return [...new Set(ids.filter(Boolean))];
}

const percent = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

/**
 * @param {Array} needs - one row per person per course they need ({ user_id, user_name, user_project_role, training_location, course_id })
 * @param {Array} assignments - the schedule's assignment rows ({ end_user_id, course_id }); a person counts once per course
 * @param {string[]} scheduleCourseIds - courses that have a session in the schedule
 * @param {string} [location] - only people at this training location
 */
export function computeAssignmentStats({ needs, assignments, scheduleCourseIds, location }) {
  const inSchedule = new Set(scheduleCourseIds.map(String));

  // Who needs what: only courses that are in this schedule, only people at the chosen location
  const people = new Map();
  (needs || []).forEach((row) => {
    if (location && row.training_location !== location) return;
    const courseId = String(row.course_id);
    if (!inSchedule.has(courseId)) return;
    const id = String(row.user_id);
    const person = people.get(id) || { id: row.user_id, name: row.user_name, role: row.user_project_role, location: row.training_location, required: new Set() };
    person.required.add(courseId);
    people.set(id, person);
  });

  // A person assigned to several parts of one course still counts once for that course
  const assignedBy = new Map();
  (assignments || []).forEach((row) => {
    const id = String(row.end_user_id);
    if (!assignedBy.has(id)) assignedBy.set(id, new Set());
    assignedBy.get(id).add(String(row.course_id));
  });
  const totalAssigned = [...assignedBy.values()].reduce((sum, courses) => sum + courses.size, 0);

  const detailedUsers = { fullyAssigned: [], partiallyAssigned: [], unassigned: [] };
  [...people.values()].forEach((person) => {
    const assignedCourses = [...person.required].filter((courseId) => assignedBy.get(String(person.id))?.has(courseId)).length;
    const entry = {
      id: person.id, name: person.name, role: person.role, location: person.location,
      requiredCourses: person.required.size, assignedCourses, missingCourses: person.required.size - assignedCourses
    };
    if (assignedCourses === entry.requiredCourses) detailedUsers.fullyAssigned.push(entry);
    else if (assignedCourses > 0) detailedUsers.partiallyAssigned.push(entry);
    else detailedUsers.unassigned.push(entry);
  });
  Object.values(detailedUsers).forEach((list) => list.sort((a, b) => String(a.name).localeCompare(String(b.name))));

  const usersNeedingAssignment = people.size;
  const fullyAssigned = detailedUsers.fullyAssigned.length;
  const partiallyAssigned = detailedUsers.partiallyAssigned.length;
  return {
    usersNeedingAssignment,
    fullyAssigned,
    partiallyAssigned,
    unassigned: detailedUsers.unassigned.length,
    totalAssigned,
    completionRate: percent(fullyAssigned, usersNeedingAssignment),
    fullyAssignedPercent: percent(fullyAssigned, usersNeedingAssignment),
    partiallyAssignedPercent: percent(partiallyAssigned, usersNeedingAssignment),
    detailedUsers,
    scheduleCourseIds: [...inSchedule],
    selectedLocation: location || 'All Locations'
  };
}
