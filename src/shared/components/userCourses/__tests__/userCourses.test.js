let mockTables = {};
let mockCalls = [];
jest.mock('@core/services/supabaseClient', () => ({ supabase: {} }));

import { EXPORT_COLUMNS, PIVOT_HIDDEN_ATTRIBUTES, SOURCE, buildUserCourseEntries, toExportRow, toPivotRow } from '../userCourseRows';
import { loadUserCourseEntries } from '../userCourseService';

const user = (id, over = {}) => ({ id, name: `Person ${id}`, email: `p${id}@x.com`, job_title: 'Clerk', country: 'UK', division: 'Finance', sub_division: 'AP', location_name: 'HQ', training_location: 'London', project_role: 'Buyer', project_id: 'p1', ...over });
const course = (id, over = {}) => ({ course_id: id, course_name: `Course ${id}`, functional_area: 'Finance', duration_hrs: 3, project_id: 'p1', ...over });
const ids = (entries) => entries.map((e) => `${e.user.id}:${e.course.course_id}:${e.source}`);

describe('buildUserCourseEntries', () => {
  const courses = [course('C1'), course('C2'), course('C3')];
  const roleMappings = [{ project_role_name: 'Buyer', course_id: 'C1' }, { project_role_name: 'Buyer', course_id: 'C2' }, { project_role_name: 'Clerk', course_id: 'C3' }];

  test('a person gets the courses of their role', () => {
    expect(ids(buildUserCourseEntries({ users: [user(1)], roleMappings, courses }))).toEqual(['1:C1:Role', '1:C2:Role']);
  });

  test('individual courses are added after the role courses, marked as individual', () => {
    const entries = buildUserCourseEntries({ users: [user(1)], roleMappings, courses, individualMappings: [{ end_user_id: 1, course_id: 'C3' }] });
    expect(ids(entries)).toEqual(['1:C1:Role', '1:C2:Role', '1:C3:Individual']);
  });

  test('a course they get both ways is listed once, as coming from the role', () => {
    const entries = buildUserCourseEntries({ users: [user(1)], roleMappings, courses, individualMappings: [{ end_user_id: 1, course_id: 'C1' }] });
    expect(ids(entries)).toEqual(['1:C1:Role', '1:C2:Role']);
  });

  test('someone with no role (or a role with no courses) can still have individual courses', () => {
    const entries = buildUserCourseEntries({ users: [user(1, { project_role: null }), user(2, { project_role: 'Nobody' })], roleMappings, courses, individualMappings: [{ end_user_id: 1, course_id: 'C3' }] });
    expect(ids(entries)).toEqual(['1:C3:Individual']);
  });

  test('a course that no longer exists is skipped instead of breaking everything', () => {
    const entries = buildUserCourseEntries({ users: [user(1)], roleMappings: [...roleMappings, { project_role_name: 'Buyer', course_id: 'GONE' }], courses, individualMappings: [{ end_user_id: 1, course_id: 'ALSO-GONE' }] });
    expect(ids(entries)).toEqual(['1:C1:Role', '1:C2:Role']);
  });

  test('people come out in name order, and one person\'s individual courses are not given to another', () => {
    const entries = buildUserCourseEntries({
      users: [user(2, { name: 'Zed' }), user(1, { name: 'Amelia' })], roleMappings: [], courses,
      individualMappings: [{ end_user_id: 2, course_id: 'C1' }, { end_user_id: 1, course_id: 'C2' }]
    });
    expect(ids(entries)).toEqual(['1:C2:Individual', '2:C1:Individual']);
  });

  test('nobody and nothing gives an empty table', () => {
    expect(buildUserCourseEntries({ users: [], roleMappings, courses })).toEqual([]);
    expect(buildUserCourseEntries({ users: [user(1)], roleMappings: [], courses: [] })).toEqual([]);
  });
});

describe('rows', () => {
  const entry = { user: user(7, { name: '  Pat  ', email: ' pat@x.com ' }), course: course('C1', { course_name: ' Ledger ' }), source: SOURCE.INDIVIDUAL };

  test('the export row has the same columns in the same order as the old file, plus where the course came from', () => {
    const row = toExportRow(entry);
    expect(Object.keys(row)).toEqual(EXPORT_COLUMNS);
    expect(EXPORT_COLUMNS.slice(0, 14)).toEqual([
      'user_id', 'user_name', 'user_email', 'job_title', 'country', 'division', 'sub_division', 'location_name', 'training_location', 'project_role',
      'course_id', 'course_name', 'functional_area', 'duration_hrs'
    ]);
    expect(row).toMatchObject({ user_id: 7, course_id: 'C1', duration_hrs: 3, course_source: 'Individual' });
  });

  test('the pivot row joins the person and the course, trims text, and adds the source and a unique key', () => {
    const row = toPivotRow(entry);
    expect(row).toMatchObject({ id: 7, name: 'Pat', email: 'pat@x.com', course_id: 'C1', course_name: 'Ledger', course_source: 'Individual', unique_key: '7-C1' });
  });

  test('technical columns are hidden from the pivot field list', () => {
    expect(PIVOT_HIDDEN_ATTRIBUTES).toEqual(expect.arrayContaining(['project_id', 'unique_key']));
  });
});

describe('loadUserCourseEntries', () => {
  const makeDb = (tables) => ({
    from: (table) => {
      const call = { table, filters: [] };
      mockCalls.push(call);
      const result = () => {
        const answer = tables[table];
        return answer instanceof Error ? { data: null, error: answer } : { data: answer, error: null };
      };
      const query = {
        select: () => query,
        eq: (column, value) => { call.filters.push([column, value]); return query; },
        order: () => query,
        range: (from, to) => Promise.resolve((() => { const r = result(); return r.error ? r : { data: r.data.slice(from, to + 1), error: null }; })()),
        then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject)
      };
      return query;
    }
  });

  beforeEach(() => {
    mockCalls = [];
    mockTables = {};
  });

  test('reads all four tables for this project and builds the table, including individual courses', async () => {
    const db = makeDb({
      end_users: [user(1)],
      role_course_mappings: [{ project_role_name: 'Buyer', course_id: 'C1' }],
      courses: [course('C1'), course('C2')],
      user_course_mappings: [{ end_user_id: 1, course_id: 'C2' }]
    });
    const entries = await loadUserCourseEntries(db, 'p1');
    expect(ids(entries)).toEqual(['1:C1:Role', '1:C2:Individual']);
    expect(mockCalls.map((c) => c.table).sort()).toEqual(['courses', 'end_users', 'role_course_mappings', 'user_course_mappings']);
    mockCalls.forEach((call) => expect(call.filters).toEqual([['project_id', 'p1']]));
  });

  test('reads past 1000 people', async () => {
    const people = Array.from({ length: 2300 }, (_, i) => user(i + 1, { project_role: 'Buyer' }));
    const db = makeDb({ end_users: people, role_course_mappings: [{ project_role_name: 'Buyer', course_id: 'C1' }], courses: [course('C1')], user_course_mappings: [] });
    expect(await loadUserCourseEntries(db, 'p1')).toHaveLength(2300);
  });

  test('an error reading any table is raised', async () => {
    const db = makeDb({ end_users: [], role_course_mappings: [], courses: new Error('courses unavailable'), user_course_mappings: [] });
    await expect(loadUserCourseEntries(db, 'p1')).rejects.toThrow('courses unavailable');
  });
});
