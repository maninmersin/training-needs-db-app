// Pure rules for the "Courses" section of the End Users edit panel. A person's courses are the courses of
// their role plus any individual (extra) assignments. No React, no database.

const byId = (a, b) => String(a.course_id).localeCompare(String(b.course_id), undefined, { numeric: true });

/** role_course_mappings rows -> Map(role name -> [course ids]). */
export function roleCourseMap(mappings) {
  const map = new Map();
  mappings.forEach((row) => {
    if (!map.has(row.project_role_name)) map.set(row.project_role_name, []);
    map.get(row.project_role_name).push(row.course_id);
  });
  return map;
}

/**
 * What the panel shows. `extraIds` is the working list (saved plus unsaved changes).
 * An extra course the role already gives is shown once, under the role, and stays saved.
 */
export function splitCourses(allCourses, roleIds, extraIds) {
  const course = new Map(allCourses.map((c) => [c.course_id, c]));
  const known = (id) => course.get(id) || { course_id: id, course_name: null };
  return {
    fromRole: roleIds.map(known).sort(byId),
    extra: extraIds.filter((id) => !roleIds.includes(id)).map(known).sort(byId)
  };
}

/** Courses that can still be added: not given by the role and not already added. */
export function addableCourses(allCourses, roleIds, extraIds, search = '') {
  const needle = search.trim().toLowerCase();
  return allCourses
    .filter((c) => !roleIds.includes(c.course_id) && !extraIds.includes(c.course_id))
    .filter((c) => !needle || [c.course_id, c.course_name, c.functional_area].some((v) => String(v ?? '').toLowerCase().includes(needle)))
    .sort(byId);
}

/** What saving would write: newly added courses, and saved ones that were removed. */
export function diffExtra(saved, draft) {
  return { add: draft.filter((id) => !saved.includes(id)), remove: saved.filter((id) => !draft.includes(id)) };
}

export const hasCourseChanges = (saved, draft) => {
  const { add, remove } = diffExtra(saved, draft);
  return add.length > 0 || remove.length > 0;
};

export const courseLabel = (course) => (course.course_name ? `${course.course_id} - ${course.course_name}` : course.course_id);
