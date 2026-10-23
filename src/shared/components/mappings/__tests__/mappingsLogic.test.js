import { diffSelection, hasChanges, searchCourses, setVisible, sortCourses, toggleCourse } from '../mappingsLogic';

const COURSES = [
  { course_id: 'C10', course_name: 'Advanced Ledger', functional_area: 'Finance', application: 'ERP' },
  { course_id: 'C2', course_name: 'Stock Counts', functional_area: 'Operations', application: null },
  { course_id: 'C1', course_name: null, functional_area: 'HR', application: 'HRIS' }
];

describe('sortCourses', () => {
  test('puts numbers inside IDs in numeric order and leaves the input alone', () => {
    const copy = [...COURSES];
    expect(sortCourses(COURSES).map((c) => c.course_id)).toEqual(['C1', 'C2', 'C10']);
    expect(COURSES).toEqual(copy);
  });

  test('a missing ID does not break the sort', () => {
    expect(sortCourses([{ course_id: 'B' }, { course_id: null }, { course_id: 'A' }]).map((c) => c.course_id)).toEqual([null, 'A', 'B']);
  });
});

describe('searchCourses', () => {
  const ids = (term) => searchCourses(COURSES, term).map((c) => c.course_id);

  test('matches ID, name, area and application, ignoring case', () => {
    expect(ids('ledger')).toEqual(['C10']);
    expect(ids('operations')).toEqual(['C2']);
    expect(ids('hris')).toEqual(['C1']);
    expect(ids('c1')).toEqual(['C10', 'C1']);
  });

  test('blank search keeps everything, and missing values never match "null"', () => {
    expect(ids('  ')).toHaveLength(3);
    expect(ids('null')).toEqual([]);
  });
});

describe('selection', () => {
  test('toggling adds a missing course and removes a present one', () => {
    expect(toggleCourse(['A'], 'B')).toEqual(['A', 'B']);
    expect(toggleCourse(['A', 'B'], 'A')).toEqual(['B']);
  });

  test('the diff lists what to insert and what to delete', () => {
    expect(diffSelection(['A', 'B'], ['B', 'C'])).toEqual({ added: ['C'], removed: ['A'] });
    expect(diffSelection(['A'], ['A'])).toEqual({ added: [], removed: [] });
  });

  test('changes are detected regardless of order', () => {
    expect(hasChanges(['A', 'B'], ['B', 'A'])).toBe(false);
    expect(hasChanges(['A'], ['A', 'B'])).toBe(true);
    expect(hasChanges(['A', 'B'], ['A'])).toBe(true);
  });

  test('select / clear shown only touches the shown courses', () => {
    const shown = [{ course_id: 'C1' }, { course_id: 'C2' }];
    expect(setVisible(['X'], shown, true)).toEqual(['X', 'C1', 'C2']);
    expect(setVisible(['X', 'C1', 'C2'], shown, false)).toEqual(['X']);
    expect(setVisible(['C1'], shown, true)).toEqual(['C1', 'C2']);
  });
});
