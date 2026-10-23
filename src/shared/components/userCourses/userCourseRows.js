// Every person with every course they need, as one flat table. Used by Export All Data and the Pivot Tables.
// Pure: no database, no React.
//
// A person's courses are the courses of their role PLUS any individual (extra) assignments. A course they
// get both ways is listed once, as coming from the role.

export const SOURCE = { ROLE: 'Role', INDIVIDUAL: 'Individual' };

const byName = (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''));

/**
 * @param {Object} data
 * @param {Array} data.users - end_users rows
 * @param {Array} data.roleMappings - role_course_mappings rows { project_role_name, course_id }
 * @param {Array} data.courses - courses rows
 * @param {Array} [data.individualMappings] - user_course_mappings rows { end_user_id, course_id }
 * @returns {Array<{ user, course, source }>} people in name order; a course that no longer exists is skipped
 */
export function buildUserCourseEntries({ users, roleMappings, courses, individualMappings = [] }) {
  const courseById = new Map(courses.map((course) => [course.course_id, course]));
  const roleCourses = new Map();
  roleMappings.forEach((mapping) => {
    if (!roleCourses.has(mapping.project_role_name)) roleCourses.set(mapping.project_role_name, []);
    roleCourses.get(mapping.project_role_name).push(mapping.course_id);
  });
  const individual = new Map();
  individualMappings.forEach((mapping) => {
    if (!individual.has(mapping.end_user_id)) individual.set(mapping.end_user_id, []);
    individual.get(mapping.end_user_id).push(mapping.course_id);
  });

  const entries = [];
  [...users].sort(byName).forEach((user) => {
    const seen = new Set();
    const add = (courseId, source) => {
      const course = courseById.get(courseId);
      if (!course || seen.has(courseId)) return;
      seen.add(courseId);
      entries.push({ user, course, source });
    };
    (roleCourses.get(user.project_role) || []).forEach((courseId) => add(courseId, SOURCE.ROLE));
    (individual.get(user.id) || []).forEach((courseId) => add(courseId, SOURCE.INDIVIDUAL));
  });
  return entries;
}

/** The columns of the export file, in the order the file has always used, plus where the course came from. */
export const EXPORT_COLUMNS = [
  'user_id', 'user_name', 'user_email', 'job_title', 'country', 'division', 'sub_division', 'location_name', 'training_location',
  'project_role', 'course_id', 'course_name', 'functional_area', 'duration_hrs', 'course_source'
];

export const toExportRow = ({ user, course, source }) => ({
  user_id: user.id,
  user_name: user.name,
  user_email: user.email,
  job_title: user.job_title,
  country: user.country,
  division: user.division,
  sub_division: user.sub_division,
  location_name: user.location_name,
  training_location: user.training_location,
  project_role: user.project_role,
  course_id: course.course_id,
  course_name: course.course_name,
  functional_area: course.functional_area,
  duration_hrs: course.duration_hrs,
  course_source: source
});

const trimmed = (record) => Object.fromEntries(Object.entries(record).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));

/**
 * One row for the pivot table: the person's details and the course's details side by side (course wins where
 * both have a column of the same name), text trimmed, plus where the course came from and a unique key.
 */
export const toPivotRow = ({ user, course, source }) => ({
  ...trimmed(user),
  ...trimmed(course),
  course_source: source,
  unique_key: `${user.id}-${course.course_id}`
});

/** Columns that mean nothing to someone building a pivot table. */
export const PIVOT_HIDDEN_ATTRIBUTES = ['project_id', 'unique_key', 'created_at', 'updated_at'];
