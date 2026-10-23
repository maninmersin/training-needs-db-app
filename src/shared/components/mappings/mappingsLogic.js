// Pure rules for the Role-Course Mappings screen. No React, no database.

/** Courses in course-ID order, numbers inside IDs compared as numbers (C2 before C10). Does not change the input. */
export const sortCourses = (courses) =>
  [...courses].sort((a, b) => (a.course_id || '').localeCompare(b.course_id || '', undefined, { numeric: true }));

/** Search over course ID, name, functional area and application, ignoring case. */
export function searchCourses(courses, searchTerm) {
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) return courses;
  return courses.filter((course) =>
    [course.course_id, course.course_name, course.functional_area, course.application].some((value) => String(value ?? '').toLowerCase().includes(needle))
  );
}

export const toggleCourse = (selected, courseId) => (selected.includes(courseId) ? selected.filter((id) => id !== courseId) : [...selected, courseId]);

/** What saving would change: courses newly ticked, and courses that were saved but are now unticked. */
export function diffSelection(saved, selected) {
  return {
    added: selected.filter((id) => !saved.includes(id)),
    removed: saved.filter((id) => !selected.includes(id))
  };
}

export const hasChanges = (saved, selected) => {
  const { added, removed } = diffSelection(saved, selected);
  return added.length > 0 || removed.length > 0;
};

/** Ticks every course in `visible` (keeping anything already ticked elsewhere), or unticks them. */
export function setVisible(selected, visible, on) {
  const ids = visible.map((course) => course.course_id);
  return on ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id));
}
