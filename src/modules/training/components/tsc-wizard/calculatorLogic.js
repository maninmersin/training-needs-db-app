// Pure maths for the Training Classroom Calculator.

export const DEFAULT_CRITERIA = { max_attendees: 10, total_weeks: 4, daily_hours: 8, days_per_week: 5, contingency: 1.2 };

/** People and their courses, grouped by training location and functional area. */
export function groupUsers(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = `${row.training_location}|${row.functional_area}`;
    if (!groups.has(key)) groups.set(key, { training_location: row.training_location, functional_area: row.functional_area, users: new Map() });
    const { users } = groups.get(key);
    if (!users.has(row.end_user_id)) users.set(row.end_user_id, new Map());
    users.get(row.end_user_id).set(row.course_id, Number(row.duration_hrs) || 0); // a course counts once per person
  });
  return [...groups.values()];
}

/**
 * Classrooms needed for each group. A classroom is available `total_weeks x days_per_week x daily_hours`
 * hours and seats `max_attendees` people, so it supplies that many user-hours; the group needs its total
 * training hours x the contingency factor.
 */
export function calculateSessions(groups, criteria) {
  const classroomHoursAvailable = criteria.days_per_week * criteria.daily_hours * criteria.total_weeks;
  const userHoursPerClassroom = classroomHoursAvailable * criteria.max_attendees;

  return groups.map((group) => {
    let hours = 0;
    group.users.forEach((courses) => courses.forEach((duration) => { hours += duration; }));
    const totalTrainingHours = hours * criteria.contingency;
    return {
      training_location: group.training_location,
      functional_area: group.functional_area,
      uniqueUserCount: group.users.size,
      totalTrainingHours,
      totalClassroomHoursAvailable: classroomHoursAvailable,
      userHoursPerClassroom,
      numberOfClassrooms: userHoursPerClassroom > 0 ? totalTrainingHours / userHoursPerClassroom : 0
    };
  });
}

/** Rows (people x courses) in, one result line per location and area out. */
export function calculate(rows, criteria) {
  if (!rows.length || !(criteria.max_attendees > 0)) return [];
  return calculateSessions(groupUsers(rows), criteria);
}

export const EXPORT_HEADERS = ['Training Location', 'Functional Area', 'Users', 'Total Training Hours', 'Total Classroom Hours Available', 'Classrooms Needed'];

export function toExportRows(calculations) {
  return calculations.map((calc) => [
    calc.training_location, calc.functional_area, calc.uniqueUserCount, calc.totalTrainingHours,
    calc.totalClassroomHoursAvailable, Number(calc.numberOfClassrooms.toFixed(2))
  ]);
}

/** A criteria field changes only to a valid value (so an in-progress edit never sets nonsense). */
export const FIELD_RULES = {
  max_attendees: (n) => n > 0,
  total_weeks: (n) => n > 0,
  daily_hours: (n) => n > 0,
  days_per_week: (n) => Number.isInteger(n) && n >= 1 && n <= 7,
  contingency: (n) => n >= 1
};

export function applyCriteriaChange(criteria, field, value) {
  return FIELD_RULES[field](value) ? { ...criteria, [field]: value } : criteria;
}
