import { tableFromRows } from '../tableFile';
import { applyPeopleImport, planPeopleImport, peopleIdsInFile } from '../peopleImport';
import { applyCoursesImport, planCoursesImport } from '../coursesImport';
import { applyAssignmentsImport, planAssignmentsImport } from '../assignmentsImport';

const table = (...rows) => tableFromRows(rows);
const byRow = (plan) => Object.fromEntries(plan.items.map((item) => [item.rowNumber, item]));

// A small fake database: records the writes and lets a test make one fail.
const fakeDb = ({ failOn = null, affected = [{ id: 1 }] } = {}) => {
  const log = [];
  const db = {
    from: (tableName) => {
      const state = { tableName, op: 'select', filters: [] };
      const query = {
        insert: (rows) => { state.op = 'insert'; state.rows = rows; return query; },
        update: (values) => { state.op = 'update'; state.values = values; return query; },
        delete: () => { state.op = 'delete'; return query; },
        eq: (column, value) => { state.filters.push([column, value]); return query; },
        in: (column, value) => { state.filters.push([column, value]); return query; },
        select: () => query,
        then: (resolve, reject) => {
          log.push({ ...state });
          const fail = failOn && failOn(state);
          return Promise.resolve(fail ? { error: { message: fail } } : { error: null, data: affected }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  return { db, log };
};

/* ------------------------------ people ------------------------------ */

const PERSON = (over = {}) => ({ id: 1, project_id: 'p1', name: 'Amelia Brown', email: 'a@x.com', job_title: 'Manager', division: 'Finance', training_location: 'London', project_role: 'Buyer', ...over });
const peopleCtx = (over = {}) => ({
  projectId: 'p1',
  existing: new Map([[1, PERSON()], [2, PERSON({ id: 2, name: 'Oliver Patel', email: 'o@x.com' })], [9, PERSON({ id: 9, project_id: 'other', name: 'Elsewhere' })]]),
  locations: ['London', 'Leeds'],
  roles: ['Buyer', 'Clerk'],
  ...over
});
const H = ['change_type', 'id', 'name', 'email', 'job_title', 'division', 'training_location', 'project_role'];

describe('planPeopleImport', () => {
  test('a file with no id column is refused with a clear message', () => {
    const plan = planPeopleImport(table(['name', 'email'], ['Pat', 'p@x.com']), peopleCtx());
    expect(plan.fileProblems[0]).toMatch(/needs an "id" column/);
    expect(plan.items).toEqual([]);
  });

  test('a new person needs a name and email, is added with the project, and a role not in the list only warns', () => {
    const plan = planPeopleImport(table(H, ['Add', '50', 'New Person', 'n@x.com', '', '', 'leeds', 'Mystery']), peopleCtx());
    const [item] = plan.items;
    expect(item.status).toBe('warning');
    expect(item.message).toBe('New person (Role "Mystery" is not in Reference Data)');
    expect(item.op).toEqual({ type: 'add', row: { id: 50, project_id: 'p1', name: 'New Person', email: 'n@x.com', training_location: 'Leeds', project_role: 'Mystery' } });
  });

  test('blank change_type, or no such column, means add-or-update', () => {
    const plan = planPeopleImport(table(['id', 'name', 'email'], ['50', 'New', 'n@x.com'], ['1', 'Amelia B', '']), peopleCtx());
    expect(plan.items[0].op.type).toBe('add');
    expect(plan.items[1].op).toEqual({ type: 'update', id: 1, values: { name: 'Amelia B' } });
    expect(plan.items[1].message).toBe('Already exists - will update: name');
  });

  test('a blank cell leaves the stored value alone; [clear] empties it; nothing to change is "unchanged"', () => {
    const plan = planPeopleImport(table(H, ['Update', '1', '', '', '[clear]', '', '', ''], ['Update', '2', 'Oliver Patel', 'o@x.com', '', '', '', '']), peopleCtx());
    const rows = byRow(plan);
    expect(rows[2].op).toEqual({ type: 'update', id: 1, values: { job_title: null } });
    expect(rows[3].status).toBe('unchanged');
    expect(rows[3].op).toBeNull();
  });

  test('name and email can never be cleared', () => {
    const plan = planPeopleImport(table(H, ['Update', '1', '[clear]', '[Clear]', '', '', '', '']), peopleCtx());
    expect(plan.items[0].status).toBe('error');
    expect(plan.items[0].message).toBe('name cannot be cleared; email cannot be cleared');
  });

  test('values are compared as written, so the same text is not reported as a change', () => {
    const plan = planPeopleImport(table(H, ['Update', '1', 'Amelia Brown', 'a@x.com', 'Manager', 'Finance', 'LONDON', 'buyer']), peopleCtx());
    expect(plan.items[0].status).toBe('unchanged');
  });

  test('row problems are reported per row and never stop the other rows', () => {
    const plan = planPeopleImport(table(H, ['Frobnicate', '1', '', '', '', '', '', ''], ['Add', '', 'X', 'x@x.com', '', '', '', ''], ['Add', 'abc', 'X', 'x@x.com', '', '', '', ''],
      ['Update', '77', 'X', '', '', '', '', ''], ['Add', '60', 'X', 'bad-email', '', '', '', ''], ['Add', '61', 'X', 'x@x.com', '', '', 'Atlantis', ''], ['Add', '62', '', 'y@x.com', '', '', '', ''], ['Add', '63', 'Fine', 'f@x.com', '', '', '', '']), peopleCtx());
    const rows = byRow(plan);
    expect(rows[2].message).toBe('Unknown change type "Frobnicate" (use Add, Update or Delete)');
    expect(rows[3].message).toBe('ID is required');
    expect(rows[4].message).toBe('ID must be a whole number');
    expect(rows[5].message).toBe('No person with ID 77 in this project');
    expect(rows[6].message).toBe('Enter a full email address');
    expect(rows[7].message).toMatch(/Training location "Atlantis" is not in Reference Data/);
    expect(rows[8].message).toBe('Name and email are required for a new person');
    expect(rows[9].status).toBe('ok');
  });

  test('the same ID twice in one file: the second is refused', () => {
    const plan = planPeopleImport(table(H, ['Add', '70', 'A', 'a@x.com', '', '', '', ''], ['Add', '70', 'B', 'b@x.com', '', '', '', '']), peopleCtx());
    expect(plan.items[0].status).toBe('ok');
    expect(plan.items[1].message).toBe('Same ID as row 2');
  });

  test('an ID that belongs to another project is never touched, whether adding, updating or deleting', () => {
    ['Add', 'Update', 'Delete'].forEach((type) => {
      const plan = planPeopleImport(table(H, [type, '9', 'Take over', 't@x.com', '', '', '', '']), peopleCtx(), { allowDeletes: true });
      expect(plan.items[0]).toMatchObject({ status: 'error', message: 'ID 9 belongs to a person in another project', op: null });
    });
  });

  test('deletes are held back unless allowed, and a delete needs the person to exist', () => {
    const rows = table(H, ['Delete', '2', '', '', '', '', '', ''], ['Delete', '88', '', '', '', '', '', '']);
    const held = planPeopleImport(rows, peopleCtx());
    expect(held.items[0]).toMatchObject({ status: 'blocked', action: 'Delete', op: null, label: 'Oliver Patel' });
    expect(held.items[1].message).toBe('No person with ID 88 in this project');
    const allowed = planPeopleImport(rows, peopleCtx(), { allowDeletes: true });
    expect(allowed.items[0]).toMatchObject({ status: 'ok', op: { type: 'delete', id: 2 } });
  });

  test('unknown columns are listed as ignored, including project_id', () => {
    const plan = planPeopleImport(table(['id', 'name', 'email', 'project_id', 'Shoe size'], ['50', 'N', 'n@x.com', 'zzz', '9']), peopleCtx());
    expect(plan.ignoredColumns).toEqual(['project_id', 'Shoe size']);
    expect(plan.items[0].op.row.project_id).toBe('p1');
  });

  test('tiles count adds, updates, deletes, held back, errors and unchanged', () => {
    const plan = planPeopleImport(table(H, ['Add', '50', 'N', 'n@x.com', '', '', '', ''], ['Update', '1', 'New Name', '', '', '', '', ''], ['Delete', '2', '', '', '', '', '', ''], ['Update', '99', '', '', '', '', '', '']), peopleCtx());
    const tile = (label) => plan.tiles.find((t) => t.label === label)?.value;
    expect(tile('New people to add')).toBe(1);
    expect(tile('Existing people updated')).toBe(1);
    expect(tile('Held back')).toBe(1);
    expect(tile('Cannot be imported')).toBe(1);
  });

  test('IDs in the file are found so only those people are loaded', () => {
    expect(peopleIdsInFile(table(['UserID', 'name'], ['5', 'a'], ['x', 'b'], ['7', 'c']))).toEqual([5, 7]);
  });
});

describe('applyPeopleImport', () => {
  const plan = () => planPeopleImport(table(H, ['Add', '50', 'N', 'n@x.com', '', '', '', ''], ['Update', '1', 'Renamed', '', '', '', '', ''], ['Delete', '2', '', '', '', '', '', ''], ['Add', '', 'bad', 'b@x.com', '', '', '', '']), peopleCtx(), { allowDeletes: true });

  test('writes only the rows that are ready, scoped to the project', async () => {
    const { db, log } = fakeDb();
    const result = await applyPeopleImport(plan().items, { db, projectId: 'p1' });
    expect(result).toMatchObject({ applied: 3, failed: 0 });
    expect(log.map((entry) => entry.op)).toEqual(['insert', 'update', 'delete']);
    expect(log[0].rows[0]).toMatchObject({ id: 50, project_id: 'p1' });
    expect(log[1].values).toEqual({ name: 'Renamed' });
    expect(log[1].filters).toEqual([['id', 1], ['project_id', 'p1']]);
    expect(log[2].filters).toEqual([['id', 2], ['project_id', 'p1']]);
  });

  test('one failure is reported and the rest still go ahead', async () => {
    const { db } = fakeDb({ failOn: (state) => (state.op === 'update' ? 'permission denied' : null) });
    const result = await applyPeopleImport(plan().items, { db, projectId: 'p1' });
    expect(result.applied).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.outcomes.find((o) => !o.ok)).toMatchObject({ message: 'permission denied' });
  });

  test('an update or delete that matches nobody is reported, not silently counted', async () => {
    const { db } = fakeDb({ affected: [] });
    const result = await applyPeopleImport(plan().items, { db, projectId: 'p1' });
    expect(result.outcomes.filter((o) => !o.ok).map((o) => o.message)).toEqual(['This person no longer exists in the project', 'This person no longer exists in the project']);
  });

  test('progress is reported after each row', async () => {
    const { db } = fakeDb();
    const seen = [];
    await applyPeopleImport(plan().items, { db, projectId: 'p1' }, (done, total) => seen.push([done, total]));
    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]]);
  });
});

/* ------------------------------ courses ------------------------------ */

const COURSE = (over = {}) => ({ course_id: 'FIN-101', project_id: 'p1', course_name: 'Ledger', functional_area: 'Finance', duration_hrs: 3, application: 'ERP', priority: 1, ...over });
const coursesCtx = () => ({ projectId: 'p1', existing: new Map([['FIN-101', COURSE()], ['OTH-1', COURSE({ course_id: 'OTH-1', project_id: 'other' })]]), areas: ['Finance', 'HR'] });
const CH = ['change_type', 'course_id', 'course_name', 'functional_area', 'duration_hrs', 'application', 'priority'];

describe('planCoursesImport', () => {
  test('a file with no course_id column is refused', () => {
    expect(planCoursesImport(table(['name']), coursesCtx()).fileProblems[0]).toMatch(/course_id/);
  });

  test('a new course needs name, area, duration and priority, and the area must exist', () => {
    const plan = planCoursesImport(table(CH, ['Add', 'HR-1', 'Induction', 'hr', '1.5', '', '2'], ['Add', 'HR-2', '', 'HR', '1', '', '1'], ['Add', 'X-1', 'X', 'Atlantis', '1', '', '1']), coursesCtx());
    expect(plan.items[0]).toMatchObject({ status: 'ok', op: { type: 'add', row: { course_id: 'HR-1', project_id: 'p1', course_name: 'Induction', functional_area: 'HR', duration_hrs: 1.5, priority: 2 } } });
    expect(plan.items[1].message).toBe('A new course needs: course name');
    expect(plan.items[2].message).toMatch(/Functional area "Atlantis" is not in Reference Data/);
  });

  test('numbers are checked', () => {
    const plan = planCoursesImport(table(CH, ['Update', 'FIN-101', '', '', '-1', '', ''], ['Update', 'FIN-101', '', '', 'abc', '', ''], ['Update', 'FIN-101', '', '', '', '', '0']), coursesCtx());
    expect(plan.items[0].message).toBe('Duration (hrs) must be a number, 0 or more');
    expect(plan.items[1].message).toBe('Same course ID as row 2');
  });

  test('priority must be a whole number of 1 or more', () => {
    const plan = planCoursesImport(table(CH, ['Update', 'FIN-101', '', '', '', '', '0']), coursesCtx());
    expect(plan.items[0].message).toBe('Priority must be a whole number, 1 or more (1 = highest)');
  });

  test('an update compares numbers as numbers (3 equals 3.0) and lists what changes', () => {
    const same = planCoursesImport(table(CH, ['Update', 'FIN-101', 'Ledger', 'Finance', '3.0', 'ERP', '1']), coursesCtx());
    expect(same.items[0].status).toBe('unchanged');
    const changed = planCoursesImport(table(CH, ['', 'FIN-101', '', '', '4', '[clear]', '']), coursesCtx());
    expect(changed.items[0].op).toEqual({ type: 'update', courseId: 'FIN-101', values: { duration_hrs: 4, application: null } });
    expect(changed.items[0].message).toBe('Already exists - will update: duration hrs, application');
  });

  test('another project\'s course is never touched, deleting needs permission and an existing course', () => {
    const plan = planCoursesImport(table(CH, ['Add', 'OTH-1', 'x', 'Finance', '1', '', '1'], ['Delete', 'FIN-101', '', '', '', '', ''], ['Delete', 'NOPE', '', '', '', '', '']), coursesCtx());
    expect(plan.items[0].message).toBe('Course ID OTH-1 belongs to another project');
    expect(plan.items[1]).toMatchObject({ status: 'blocked', op: null });
    expect(plan.items[2].message).toBe('No course NOPE in this project');
    const allowed = planCoursesImport(table(CH, ['Delete', 'FIN-101', '', '', '', '', '']), coursesCtx(), { allowDeletes: true });
    expect(allowed.items[0].op).toEqual({ type: 'delete', courseId: 'FIN-101' });
    expect(allowed.items[0].message).toMatch(/individual course assignments for it are removed too/);
  });
});

describe('applyCoursesImport', () => {
  test('inserts, updates and deletes scoped to the project', async () => {
    const plan = planCoursesImport(table(CH, ['Add', 'HR-1', 'Induction', 'HR', '1', '', '1'], ['Update', 'FIN-101', '', '', '5', '', ''], ['Delete', 'FIN-101x', '', '', '', '', '']), coursesCtx(), { allowDeletes: true });
    const { db, log } = fakeDb();
    const result = await applyCoursesImport(plan.items, { db, projectId: 'p1' });
    expect(result.applied).toBe(2);
    expect(log.map((e) => e.op)).toEqual(['insert', 'update']);
    expect(log[1].filters).toEqual([['course_id', 'FIN-101'], ['project_id', 'p1']]);
  });
});

/* ---------------------------- assignments ---------------------------- */

const AH = ['UserID', 'Name', 'Email', 'Role', 'Location', 'CourseID'];
const assignCtx = (over = {}) => ({
  projectId: 'p1',
  people: new Map([[1, { id: 1, name: 'Amelia Brown', project_id: 'p1' }], [9, { id: 9, name: 'Elsewhere', project_id: 'other' }]]),
  courses: ['C1', 'C2', 'C3'],
  current: new Map([[1, ['C1', 'C3']]]),
  locations: ['London'],
  roles: ['Buyer'],
  ...over
});

describe('planAssignmentsImport', () => {
  test('a file missing UserID or CourseID is refused', () => {
    const plan = planAssignmentsImport(table(['Name', 'CourseID'], ['x', 'C1']), assignCtx());
    expect(plan.fileProblems[0]).toBe('The file needs these columns: UserID.');
  });

  test('replace mode adds the new courses and removes the ones not listed, per person', () => {
    const plan = planAssignmentsImport(table(AH, ['1', 'Amelia Brown', 'a@x.com', '', '', 'C1'], ['1', 'Amelia Brown', 'a@x.com', '', '', 'C2']), assignCtx());
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].op).toEqual({ type: 'assign', id: 1, create: null, add: ['C2'], remove: ['C3'] });
    expect(plan.items[0].message).toBe('Add C2 - remove C3');
  });

  test('add-only mode never removes', () => {
    const plan = planAssignmentsImport(table(AH, ['1', '', '', '', '', 'C2']), assignCtx(), { mode: 'add' });
    expect(plan.items[0].op.remove).toEqual([]);
    expect(plan.items[0].op.add).toEqual(['C2']);
  });

  test('a person who already has exactly these courses is unchanged', () => {
    const plan = planAssignmentsImport(table(AH, ['1', '', '', '', '', 'C3'], ['1', '', '', '', '', 'c1']), assignCtx());
    expect(plan.items[0].status).toBe('unchanged');
  });

  test('an unknown course leaves that whole person out, naming the courses', () => {
    const plan = planAssignmentsImport(table(AH, ['1', '', '', '', '', 'C2'], ['1', '', '', '', '', 'ZZ'], ['1', '', '', '', '', 'YY']), assignCtx());
    expect(plan.items[0]).toMatchObject({ status: 'error', op: null });
    expect(plan.items[0].message).toBe('Courses not found in this project: ZZ, YY (import courses first)');
  });

  test('a new person is created from the row, needs name and email, and a bad location is refused', () => {
    const ok = planAssignmentsImport(table(AH, ['50', 'New Person', 'n@x.com', 'buyer', 'london', 'C1']), assignCtx());
    expect(ok.items[0].op).toEqual({
      type: 'assign', id: 50, add: ['C1'], remove: [],
      create: { id: 50, project_id: 'p1', name: 'New Person', email: 'n@x.com', project_role: 'Buyer', training_location: 'London' }
    });
    expect(ok.items[0].action).toBe('Add');
    expect(planAssignmentsImport(table(AH, ['51', '', '', '', '', 'C1']), assignCtx()).items[0].message).toBe('Name and email are required for a new person');
    expect(planAssignmentsImport(table(AH, ['52', 'N', 'n@x.com', '', 'Atlantis', 'C1']), assignCtx()).items[0].message).toMatch(/Training location "Atlantis"/);
  });

  test('an existing person\'s details in the file are not used, and another project\'s person is refused', () => {
    const plan = planAssignmentsImport(table(AH, ['1', 'Different Name', 'diff@x.com', '', '', 'C2'], ['9', '', '', '', '', 'C1']), assignCtx());
    expect(plan.items[0].op.create).toBeNull();
    expect(plan.items[1].message).toBe('ID 9 belongs to a person in another project');
  });

  test('bad rows are reported by row; good rows still plan', () => {
    const plan = planAssignmentsImport(table(AH, ['', '', '', '', '', 'C1'], ['x', '', '', '', '', 'C1'], ['1', '', '', '', '', ''], ['1', '', '', '', '', 'C2']), assignCtx());
    expect(plan.items.map((i) => i.message)).toEqual(['UserID is required', 'UserID must be a whole number', 'CourseID is required', expect.stringContaining('Add C2')]);
  });

  test('tiles total courses added and removed', () => {
    const plan = planAssignmentsImport(table(AH, ['1', '', '', '', '', 'C2']), assignCtx());
    const tile = (label) => plan.tiles.find((t) => t.label === label)?.value;
    expect(tile('People with changes')).toBe(1);
    expect(tile('Courses added')).toBe(1);
    expect(tile('Courses removed')).toBe(2);
  });
});

describe('applyAssignmentsImport', () => {
  const plan = () => planAssignmentsImport(table(AH, ['1', '', '', '', '', 'C2'], ['50', 'New Person', 'n@x.com', '', '', 'C1']), assignCtx());

  test('creates the person, adds courses first, and removes only afterwards', async () => {
    const { db, log } = fakeDb();
    const result = await applyAssignmentsImport(plan().items, { db, projectId: 'p1' });
    expect(result).toMatchObject({ applied: 2, failed: 0 });
    expect(log.map((e) => `${e.op} ${e.tableName}`)).toEqual([
      'insert user_course_mappings', 'delete user_course_mappings', 'insert end_users', 'insert user_course_mappings'
    ]);
    expect(log[0].rows[0]).toMatchObject({ project_id: 'p1', end_user_id: 1, course_id: 'C2', assigned_by: 'bulk' });
  });

  test('if adding fails, nothing is removed for that person', async () => {
    const { db, log } = fakeDb({ failOn: (state) => (state.op === 'insert' && state.tableName === 'user_course_mappings' ? 'insert refused' : null) });
    const result = await applyAssignmentsImport(plan().items, { db, projectId: 'p1' });
    expect(result.failed).toBe(2);
    expect(log.some((e) => e.op === 'delete')).toBe(false);
  });
});

describe('locations and areas that are switched off (inactive)', () => {
  // Everyone already has London or Manchester, but both have since been switched off in Reference Data
  const inactiveCtx = () => peopleCtx({
    locations: [],
    inactiveLocations: ['London', 'Leeds'],
    existing: new Map([[1, PERSON()], [2, PERSON({ id: 2, name: 'Oliver Patel', email: 'o@x.com', training_location: 'Leeds', project_role: 'Mystery' })]])
  });

  test('an exported file imports straight back: unchanged locations and roles are not checked again', () => {
    const plan = planPeopleImport(table(H, ['', '1', 'Amelia Brown', 'a@x.com', 'Manager', 'Finance', 'London', 'Buyer'], ['', '2', 'Oliver Patel', 'o@x.com', 'Manager', 'Finance', 'leeds', 'Mystery']), inactiveCtx());
    expect(plan.items.map((i) => i.status)).toEqual(['unchanged', 'unchanged']);
  });

  test('a rename of someone with a switched-off location works and keeps their location', () => {
    const plan = planPeopleImport(table(H, ['', '1', 'Amelia Green', 'a@x.com', 'Manager', 'Finance', 'London', 'Buyer']), inactiveCtx());
    expect(plan.items[0]).toMatchObject({ status: 'ok', op: { type: 'update', id: 1, values: { name: 'Amelia Green' } } });
  });

  test('moving a person TO a switched-off location, or adding a new person there, says it is switched off', () => {
    const move = planPeopleImport(table(H, ['Update', '1', '', '', '', '', 'Leeds', '']), inactiveCtx());
    expect(move.items[0]).toMatchObject({ status: 'error', message: 'Training location "Leeds" is switched off (inactive) in Reference Data' });
    const add = planPeopleImport(table(H, ['Add', '50', 'New', 'n@x.com', '', '', 'London', '']), inactiveCtx());
    expect(add.items[0].message).toBe('Training location "London" is switched off (inactive) in Reference Data');
  });

  test('a location that does not exist at all still says to add it', () => {
    const plan = planPeopleImport(table(H, ['Add', '50', 'New', 'n@x.com', '', '', 'Atlantis', '']), inactiveCtx());
    expect(plan.items[0].message).toMatch(/is not in Reference Data \(add it there first\)/);
  });

  test('courses behave the same: an unchanged functional area is fine, a switched-off one is named', () => {
    const ctx = { projectId: 'p1', existing: new Map([['FIN-101', COURSE()]]), areas: ['HR'], inactiveAreas: ['Finance'] };
    const same = planCoursesImport(table(CH, ['', 'FIN-101', 'Ledger 2', 'finance', '', '', '']), ctx);
    expect(same.items[0]).toMatchObject({ status: 'ok', op: { values: { course_name: 'Ledger 2' } } });
    const move = planCoursesImport(table(CH, ['Add', 'NEW-1', 'N', 'Finance', '1', '', '1']), ctx);
    expect(move.items[0].message).toBe('Functional area "Finance" is switched off (inactive) in Reference Data');
  });
});
