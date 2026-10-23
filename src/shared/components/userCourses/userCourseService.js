import { fetchAllRows } from '@core/utils/fetchAllRows';
import { buildUserCourseEntries } from './userCourseRows';

/**
 * Read everything needed for the person-by-course table, past the 1000-row limit (the old screens stopped
 * at 1000 people, role mappings or courses without saying so).
 * @returns {Promise<Array<{ user, course, source }>>}
 */
export async function loadUserCourseEntries(db, projectId) {
  const [users, roleMappings, courses, individualMappings] = await Promise.all([
    fetchAllRows(() => db.from('end_users').select('*').eq('project_id', projectId)),
    fetchAllRows(() => db.from('role_course_mappings').select('*').eq('project_id', projectId)),
    // courses has no id column, so it is read directly (a project has far fewer than 1000)
    db.from('courses').select('*').eq('project_id', projectId).then(({ data, error }) => {
      if (error) throw error;
      return data || [];
    }),
    fetchAllRows(() => db.from('user_course_mappings').select('end_user_id, course_id').eq('project_id', projectId))
  ]);
  return buildUserCourseEntries({ users, roleMappings, courses, individualMappings });
}
