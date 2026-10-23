import { fetchAllRows } from '@core/utils/fetchAllRows';
import { roleCourseMap } from './userCoursesLogic';

/**
 * Everything the Courses section needs: the project's courses, each role's courses, and (for an existing
 * person) the individual courses already assigned. Throws on a database error.
 */
export async function loadCourseContext(db, projectId, userId) {
  const coursesResult = await db.from('courses').select('course_id, course_name, functional_area').eq('project_id', projectId);
  if (coursesResult.error) throw coursesResult.error;

  const mappings = await fetchAllRows(() => db.from('role_course_mappings').select('project_role_name, course_id').eq('project_id', projectId));

  let extraIds = [];
  if (userId !== undefined && userId !== null) {
    const extra = await db.from('user_course_mappings').select('course_id').eq('project_id', projectId).eq('end_user_id', userId);
    if (extra.error) throw extra.error;
    extraIds = (extra.data || []).map((row) => row.course_id);
  }
  return { courses: coursesResult.data || [], roleCourses: roleCourseMap(mappings), extraIds };
}

/** Add the new individual courses first, then remove the dropped ones (so a failure never leaves someone with fewer). */
export async function saveExtraCourses(db, projectId, userId, { add, remove }) {
  if (add.length > 0) {
    const now = new Date().toISOString();
    const { error } = await db
      .from('user_course_mappings')
      .insert(add.map((courseId) => ({ project_id: projectId, end_user_id: userId, course_id: courseId, assigned_by: 'admin', assigned_date: now })));
    if (error) throw error;
  }
  if (remove.length > 0) {
    const { error } = await db.from('user_course_mappings').delete().eq('project_id', projectId).eq('end_user_id', userId).in('course_id', remove);
    if (error) throw error;
  }
}
