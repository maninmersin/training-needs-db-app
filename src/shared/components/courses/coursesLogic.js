// Pure rules for the Courses screen: search fields, validation, and what gets saved. No React, no database.
import { filterRows, textOf } from '../listFilters';

export { activeFilterCount, uniqueColumnValues } from '../listFilters';

export const SEARCH_FIELDS = ['course_id', 'course_name', 'functional_area', 'duration_hrs', 'application', 'priority'];

export const filterCourses = (courses, searchTerm, columnFilters) => filterRows(courses, SEARCH_FIELDS, searchTerm, columnFilters);

/** Priority 1 is the highest; a blank box means 1, as before. */
const priorityOf = (raw) => {
  const text = textOf(raw).trim();
  return text === '' ? 1 : Number(text);
};

/** { field: message } for a draft; empty means valid. The ID is only checked when adding. */
export function validateCourseDraft(draft, { isNew }) {
  const errors = {};
  if (isNew && textOf(draft.course_id).trim() === '') errors.course_id = 'Course ID is required';

  const duration = textOf(draft.duration_hrs).trim();
  if (duration === '' || Number.isNaN(Number(duration))) errors.duration_hrs = 'Enter the duration in hours';
  else if (Number(duration) < 0) errors.duration_hrs = 'Duration cannot be negative';

  const priority = priorityOf(draft.priority);
  if (!Number.isInteger(priority) || priority < 1) errors.priority = 'Priority must be a whole number, 1 or more (1 = highest)';
  return errors;
}

/** The row to insert from a valid draft. */
export function draftToCourse(draft) {
  return {
    course_id: textOf(draft.course_id).trim(),
    course_name: draft.course_name,
    functional_area: draft.functional_area,
    duration_hrs: Number(draft.duration_hrs),
    application: draft.application,
    priority: priorityOf(draft.priority)
  };
}

/** Only the fields whose value differs from the saved course (so 2 equals "2"). The ID is never changed. */
export function changedCourseFields(course, draft) {
  const next = draftToCourse({ ...draft, course_id: course.course_id });
  const changes = {};
  ['course_name', 'functional_area', 'duration_hrs', 'application', 'priority'].forEach((field) => {
    const before = field === 'priority' ? course.priority ?? 1 : course[field];
    if (textOf(next[field]) !== textOf(before)) changes[field] = next[field];
  });
  return changes;
}

/** A blank form for a new course: duration 0 and the first functional area, as before. */
export const blankCourseDraft = (functionalAreas) => ({
  course_id: '',
  course_name: '',
  functional_area: functionalAreas[0]?.name || '',
  duration_hrs: '0',
  application: '',
  priority: '1'
});

export const courseToDraft = (course) => ({
  course_id: course.course_id,
  course_name: course.course_name ?? '',
  functional_area: course.functional_area ?? '',
  duration_hrs: textOf(course.duration_hrs),
  application: course.application ?? '',
  priority: textOf(course.priority ?? 1)
});
