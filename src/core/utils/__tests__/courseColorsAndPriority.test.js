import {
  COLOR_PALETTE,
  buildCourseColorMapFromSessions,
  getColorByCourseTitle
} from '../colorUtils';
import { sortCoursesByPriority } from '../scheduling/SchedulingCore';

const session = (name, priority) => ({ start: new Date(2026, 9, 12), course: { course_name: name, priority } });

describe('course colours', () => {
  // These names all hash to the same palette colour with the old hash-only rule
  const names = ['Inventory Transactions', 'Purchase Orders & Suppliers', 'Employee Self Service'];

  test('the old hash rule collides for these courses (why a map is needed)', () => {
    const colors = names.map((n) => getColorByCourseTitle(n).backgroundColor);
    expect(new Set(colors).size).toBe(1);
  });

  test('every course in a calendar gets its own colour', () => {
    const map = buildCourseColorMapFromSessions(names.map((n) => session(n)));
    const colors = names.map((n) => getColorByCourseTitle(n, map).backgroundColor);
    expect(new Set(colors).size).toBe(names.length);
  });

  test('works on the nested wizard structure and on a flat array, with the same result', () => {
    const sessions = names.map((n) => session(n));
    const nested = { General: { 'London|Supply Chain': { 'Classroom 1': sessions } } };
    expect(buildCourseColorMapFromSessions(nested)).toEqual(buildCourseColorMapFromSessions(sessions));
  });

  test('colours do not depend on priority, so a reopened schedule matches the preview', () => {
    const withPriority = buildCourseColorMapFromSessions(names.map((n, i) => session(n, i + 1)));
    const withoutPriority = buildCourseColorMapFromSessions(names.map((n) => session(n)));
    expect(withPriority).toEqual(withoutPriority);
  });

  test('falls back to the title for sessions without a course object', () => {
    const map = buildCourseColorMapFromSessions([{ start: new Date(), title: 'Transfers - Group 1 (Part 1)' }]);
    expect(Object.keys(map)).toEqual(['Transfers']);
  });

  test('reuses palette colours only after the palette is exhausted', () => {
    const many = Array.from({ length: 13 }, (_, i) => `Course ${String(i).padStart(2, '0')}`);
    const map = buildCourseColorMapFromSessions(many.map((n) => session(n)));
    const distinct = new Set(many.map((n) => map[n].backgroundColor));
    expect(distinct.size).toBe(Object.keys(COLOR_PALETTE).length - 1); // palette minus "default"
  });

  test('unknown titles still get a colour', () => {
    expect(getColorByCourseTitle('Unlisted', {}).backgroundColor).toBeTruthy();
    expect(getColorByCourseTitle(null)).toBe(COLOR_PALETTE.default);
  });
});

describe('sortCoursesByPriority', () => {
  const course = (course_id, priority) => ({ course_id, course_name: `Course ${course_id}`, priority });

  test('lower priority number comes first', () => {
    const sorted = sortCoursesByPriority([course('A', 3), course('B', 1), course('C', 2)]);
    expect(sorted.map((c) => c.course_id)).toEqual(['B', 'C', 'A']);
  });

  test('courses with no priority go last', () => {
    const sorted = sortCoursesByPriority([course('A', undefined), course('B', 2)]);
    expect(sorted.map((c) => c.course_id)).toEqual(['B', 'A']);
  });

  test('equal priority falls back to course id, numeric-aware, regardless of input order', () => {
    const one = sortCoursesByPriority([course('10', 1), course('2', 1), course('1', 1)]);
    const two = sortCoursesByPriority([course('1', 1), course('10', 1), course('2', 1)]);
    expect(one.map((c) => c.course_id)).toEqual(['1', '2', '10']);
    expect(two.map((c) => c.course_id)).toEqual(['1', '2', '10']);
  });

  test('does not modify the input array', () => {
    const input = [course('B', 2), course('A', 1)];
    sortCoursesByPriority(input);
    expect(input.map((c) => c.course_id)).toEqual(['B', 'A']);
  });
});
