import { computeAssignmentStats, flattenSessions, scheduleCourseIdsOf } from '../assignmentStatsLogic';

describe('scheduleCourseIdsOf', () => {
  test('reads the courses out of the nested schedule structure, as text, once each', () => {
    const sessions = {
      Finance: { Dubai: { 'Classroom 1': [{ course_id: 'c1' }, { course_id: 'c1' }, { course: { course_id: 2 } }] } },
      HR: { Leeds: { 'Classroom 1': [{ courseId: 'c3' }, {}] } }
    };
    expect(scheduleCourseIdsOf(sessions).sort()).toEqual(['2', 'c1', 'c3']);
  });

  test('copes with a plain list, nothing, and odd values', () => {
    expect(scheduleCourseIdsOf([{ course_id: 'a' }])).toEqual(['a']);
    expect(scheduleCourseIdsOf(null)).toEqual([]);
    expect(flattenSessions('text')).toEqual([]);
  });
});

describe('computeAssignmentStats', () => {
  const need = (user, course, location = 'Dubai', role = 'Clerk') => ({ user_id: user, user_name: `P${user}`, user_project_role: role, training_location: location, course_id: course });
  const needs = [
    need(1, 'c1'), need(1, 'c2'), // needs both
    need(2, 'c1'), need(2, 'c2'), // needs both
    need(3, 'c1'), need(3, 'c2'), // needs both
    need(4, 'c9'), // course not in this schedule: not counted
    need(5, 'c1', 'Leeds') // other location
  ];
  const base = { needs, scheduleCourseIds: ['c1', 'c2'] };

  test('splits people into fully, partly and not assigned', () => {
    const assignments = [
      { end_user_id: 1, course_id: 'c1' }, { end_user_id: 1, course_id: 'c2' }, // fully
      { end_user_id: 2, course_id: 'c1' } // partly
    ]; // person 3: nothing
    const stats = computeAssignmentStats({ ...base, assignments });
    expect(stats).toMatchObject({ usersNeedingAssignment: 4, fullyAssigned: 1, partiallyAssigned: 1, unassigned: 2, completionRate: 25 });
    expect(stats.detailedUsers.partiallyAssigned[0]).toMatchObject({ name: 'P2', requiredCourses: 2, assignedCourses: 1, missingCourses: 1 });
  });

  test('several parts of one course count once, and ids match as text', () => {
    const assignments = [{ end_user_id: '1', course_id: 'c1' }, { end_user_id: 1, course_id: 'c1' }, { end_user_id: 1, course_id: 'c1' }];
    const stats = computeAssignmentStats({ ...base, assignments });
    expect(stats.totalAssigned).toBe(1);
    expect(stats.detailedUsers.partiallyAssigned.map((u) => u.name)).toContain('P1');
  });

  test('a location limits who is counted', () => {
    const stats = computeAssignmentStats({ ...base, assignments: [], location: 'Leeds' });
    expect(stats).toMatchObject({ usersNeedingAssignment: 1, unassigned: 1, selectedLocation: 'Leeds' });
  });

  test('nobody needing anything gives 0%, not NaN', () => {
    const stats = computeAssignmentStats({ needs: [], assignments: [], scheduleCourseIds: ['c1'] });
    expect(stats).toMatchObject({ usersNeedingAssignment: 0, completionRate: 0, fullyAssignedPercent: 0, selectedLocation: 'All Locations' });
  });

  test('people are listed by name', () => {
    const stats = computeAssignmentStats({ ...base, assignments: [] });
    expect(stats.detailedUsers.unassigned.map((u) => u.name)).toEqual(['P1', 'P2', 'P3', 'P5']);
  });
});
