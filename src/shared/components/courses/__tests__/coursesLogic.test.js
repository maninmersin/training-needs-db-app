import { blankCourseDraft, changedCourseFields, courseToDraft, draftToCourse, filterCourses, validateCourseDraft } from '../coursesLogic';

const COURSES = [
  { course_id: 'FIN-101', course_name: 'Ledger Basics', functional_area: 'Finance', duration_hrs: 3, application: 'ERP', priority: 1 },
  { course_id: 'HR-201', course_name: null, functional_area: 'HR', duration_hrs: 1.5, application: null, priority: 2 },
  { course_id: 'OPS-301', course_name: 'Stock Counts', functional_area: 'Operations', duration_hrs: 3, application: 'WMS', priority: null }
];

describe('filterCourses', () => {
  test('search covers ID, name, area, duration, application and priority', () => {
    const ids = (term) => filterCourses(COURSES, term, {}).map((c) => c.course_id);
    expect(ids('ledger')).toEqual(['FIN-101']);
    expect(ids('hr-')).toEqual(['HR-201']);
    expect(ids('operations')).toEqual(['OPS-301']);
    expect(ids('1.5')).toEqual(['HR-201']);
    expect(ids('wms')).toEqual(['OPS-301']);
    expect(ids('2')).toContain('HR-201');
  });

  test('a course with no name or application does not break the search', () => {
    expect(filterCourses(COURSES, 'zzz', {})).toEqual([]);
  });

  test('column filters work on numbers and blanks', () => {
    expect(filterCourses(COURSES, '', { duration_hrs: ['3'] }).map((c) => c.course_id)).toEqual(['FIN-101', 'OPS-301']);
    expect(filterCourses(COURSES, '', { application: ['__BLANK__'] }).map((c) => c.course_id)).toEqual(['HR-201']);
  });
});

describe('validateCourseDraft', () => {
  const ok = { course_id: 'A1', duration_hrs: '2', priority: '1' };

  test('a good draft is valid', () => {
    expect(validateCourseDraft(ok, { isNew: true })).toEqual({});
  });

  test('the ID is required only when adding', () => {
    expect(validateCourseDraft({ ...ok, course_id: ' ' }, { isNew: true }).course_id).toBe('Course ID is required');
    expect(validateCourseDraft({ ...ok, course_id: '' }, { isNew: false })).toEqual({});
  });

  test('duration must be a number that is not negative', () => {
    expect(validateCourseDraft({ ...ok, duration_hrs: '' }, { isNew: false }).duration_hrs).toBe('Enter the duration in hours');
    expect(validateCourseDraft({ ...ok, duration_hrs: 'abc' }, { isNew: false }).duration_hrs).toBe('Enter the duration in hours');
    expect(validateCourseDraft({ ...ok, duration_hrs: '-1' }, { isNew: false }).duration_hrs).toBe('Duration cannot be negative');
    expect(validateCourseDraft({ ...ok, duration_hrs: '1.5' }, { isNew: false })).toEqual({});
    expect(validateCourseDraft({ ...ok, duration_hrs: '0' }, { isNew: false })).toEqual({});
  });

  test('priority is a whole number of 1 or more; blank means 1', () => {
    expect(validateCourseDraft({ ...ok, priority: '' }, { isNew: false })).toEqual({});
    expect(validateCourseDraft({ ...ok, priority: '0' }, { isNew: false }).priority).toMatch(/whole number/);
    expect(validateCourseDraft({ ...ok, priority: '2.5' }, { isNew: false }).priority).toMatch(/whole number/);
    expect(validateCourseDraft({ ...ok, priority: 'x' }, { isNew: false }).priority).toMatch(/whole number/);
  });
});

describe('what gets saved', () => {
  test('a draft becomes a row with numbers, a trimmed ID and priority defaulting to 1', () => {
    expect(draftToCourse({ course_id: ' A1 ', course_name: 'N', functional_area: 'F', duration_hrs: '2.5', application: '', priority: '' })).toEqual({
      course_id: 'A1', course_name: 'N', functional_area: 'F', duration_hrs: 2.5, application: '', priority: 1
    });
  });

  test('a stored course round-trips through the form without showing as changed', () => {
    COURSES.forEach((course) => expect(changedCourseFields(course, courseToDraft(course))).toEqual({}));
  });

  test('only edited fields are reported, and the ID can never change', () => {
    const draft = { ...courseToDraft(COURSES[0]), course_id: 'HACKED', duration_hrs: '4', course_name: 'Ledger Basics 2' };
    expect(changedCourseFields(COURSES[0], draft)).toEqual({ duration_hrs: 4, course_name: 'Ledger Basics 2' });
  });

  test('a missing priority counts as 1', () => {
    expect(changedCourseFields(COURSES[2], { ...courseToDraft(COURSES[2]), priority: '1' })).toEqual({});
    expect(changedCourseFields(COURSES[2], { ...courseToDraft(COURSES[2]), priority: '3' })).toEqual({ priority: 3 });
  });

  test('a new course starts with duration 0 and the first functional area', () => {
    expect(blankCourseDraft([{ name: 'Finance' }, { name: 'HR' }])).toEqual({
      course_id: '', course_name: '', functional_area: 'Finance', duration_hrs: '0', application: '', priority: '1'
    });
    expect(blankCourseDraft([]).functional_area).toBe('');
  });
});
