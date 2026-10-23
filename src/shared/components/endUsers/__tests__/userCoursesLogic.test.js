import { addableCourses, courseLabel, diffExtra, hasCourseChanges, roleCourseMap, splitCourses } from '../userCoursesLogic';

const COURSES = [
  { course_id: 'C10', course_name: 'Advanced Ledger', functional_area: 'Finance' },
  { course_id: 'C2', course_name: 'Stock Counts', functional_area: 'Operations' },
  { course_id: 'C1', course_name: null, functional_area: 'HR' }
];

describe('roleCourseMap', () => {
  test('groups course ids by role name', () => {
    const map = roleCourseMap([
      { project_role_name: 'Buyer', course_id: 'C1' },
      { project_role_name: 'Clerk', course_id: 'C2' },
      { project_role_name: 'Buyer', course_id: 'C10' }
    ]);
    expect(map.get('Buyer')).toEqual(['C1', 'C10']);
    expect(map.get('Clerk')).toEqual(['C2']);
    expect(map.get('Nobody')).toBeUndefined();
  });
});

describe('splitCourses', () => {
  test('role and extra courses are sorted with numbers in order (C2 before C10)', () => {
    const { fromRole, extra } = splitCourses(COURSES, ['C10', 'C1'], ['C2']);
    expect(fromRole.map((c) => c.course_id)).toEqual(['C1', 'C10']);
    expect(extra.map((c) => c.course_id)).toEqual(['C2']);
  });

  test('an extra course the role also gives is shown once, under the role', () => {
    const { fromRole, extra } = splitCourses(COURSES, ['C1'], ['C1', 'C2']);
    expect(fromRole.map((c) => c.course_id)).toEqual(['C1']);
    expect(extra.map((c) => c.course_id)).toEqual(['C2']);
  });

  test('a course id that is no longer in the project is still listed rather than dropped', () => {
    const { extra } = splitCourses(COURSES, [], ['GONE']);
    expect(extra).toEqual([{ course_id: 'GONE', course_name: null }]);
  });
});

describe('addableCourses', () => {
  test('excludes role courses and ones already added', () => {
    expect(addableCourses(COURSES, ['C1'], ['C2']).map((c) => c.course_id)).toEqual(['C10']);
  });

  test('searches id, name and area, ignoring case; blank keeps all', () => {
    expect(addableCourses(COURSES, [], [], 'ledger').map((c) => c.course_id)).toEqual(['C10']);
    expect(addableCourses(COURSES, [], [], 'OPERATIONS').map((c) => c.course_id)).toEqual(['C2']);
    expect(addableCourses(COURSES, [], [], '  ')).toHaveLength(3);
    expect(addableCourses(COURSES, [], [], 'zzz')).toEqual([]);
  });
});

describe('changes', () => {
  test('the diff lists what to add and remove, in any order', () => {
    expect(diffExtra(['A', 'B'], ['B', 'C'])).toEqual({ add: ['C'], remove: ['A'] });
    expect(hasCourseChanges(['A', 'B'], ['B', 'A'])).toBe(false);
    expect(hasCourseChanges(['A'], ['A', 'B'])).toBe(true);
    expect(hasCourseChanges(['A', 'B'], ['A'])).toBe(true);
  });

  test('labels show the name when there is one', () => {
    expect(courseLabel(COURSES[0])).toBe('C10 - Advanced Ledger');
    expect(courseLabel(COURSES[2])).toBe('C1');
  });
});
