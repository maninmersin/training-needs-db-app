// npm run db:seed-tna -- "<project title>"
//
// Fills an in-app TNA project (training_data_source = 'app') with fictional demo data:
// functional areas, training locations, roles, courses, people, role-course mappings, a
// few individual course assignments and trainers. Only adds rows - safe to re-run, never deletes.
// People are topped up per location and role to the PEOPLE targets below, so re-running after
// you delete a location or edit users won't recreate them or duplicate anyone.
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { databaseUrl } from '../scripts/local/config.js';

const FUNCTIONAL_AREAS = ['Finance', 'Procurement', 'Supply Chain', 'HR'];

const LOCATIONS = [
  { name: 'London', capacity: 12, classrooms_count: 2 },
  { name: 'Manchester', capacity: 10, classrooms_count: 1 }
];

// course_id is unique across all projects, hence the ACME- prefix
const COURSES = [
  ['ACME-FIN-101', 'General Ledger Basics', 'Finance', 3, 1],
  ['ACME-FIN-102', 'Accounts Payable Processing', 'Finance', 4, 1],
  ['ACME-FIN-201', 'Month-End Close', 'Finance', 6, 2],
  ['ACME-PRC-101', 'Requisitions & Approvals', 'Procurement', 2, 1],
  ['ACME-PRC-201', 'Purchase Orders & Suppliers', 'Procurement', 4, 2],
  ['ACME-SCM-101', 'Inventory Transactions', 'Supply Chain', 3, 1],
  ['ACME-SCM-201', 'Warehouse Receiving & Picking', 'Supply Chain', 4, 2],
  ['ACME-HR-101', 'Employee Self Service', 'HR', 1, 1],
  ['ACME-HR-201', 'Core HR Administration', 'HR', 5, 2]
];

// role -> division and courses (everyone with the role gets these)
const ROLES = {
  'Finance Manager': { division: 'Finance', courses: ['ACME-FIN-101', 'ACME-FIN-201', 'ACME-PRC-101', 'ACME-HR-101'] },
  'Accounts Payable Clerk': { division: 'Finance', courses: ['ACME-FIN-101', 'ACME-FIN-102', 'ACME-HR-101'] },
  'Buyer': { division: 'Procurement', courses: ['ACME-PRC-101', 'ACME-PRC-201', 'ACME-HR-101'] },
  'Warehouse Supervisor': { division: 'Operations', courses: ['ACME-SCM-101', 'ACME-SCM-201', 'ACME-PRC-101', 'ACME-HR-101'] },
  'Store Manager': { division: 'Operations', courses: ['ACME-SCM-101', 'ACME-PRC-101', 'ACME-HR-101'] },
  'HR Advisor': { division: 'HR', courses: ['ACME-HR-101', 'ACME-HR-201'] }
};

const FIRST = ['Amelia', 'Oliver', 'Isla', 'George', 'Ava', 'Harry', 'Mia', 'Noah', 'Sophia', 'Jack',
  'Grace', 'Leo', 'Freya', 'Arthur', 'Lily', 'Oscar', 'Ella', 'Theo', 'Ruby', 'Henry', 'Evie',
  'Charlie', 'Poppy', 'Alfie', 'Daisy', 'Jacob', 'Ivy', 'Thomas', 'Rosie', 'James', 'Millie', 'Ethan',
  'Zara', 'Samuel', 'Chloe', 'Daniel', 'Maya', 'Lucas', 'Hannah', 'Adam', 'Erin', 'Ryan',
  'Holly', 'Ben', 'Megan', 'Owen', 'Alice', 'Luke', 'Lucy', 'Max', 'Imogen', 'Finn'];
const LAST = ['Smith', 'Jones', 'Taylor', 'Brown', 'Williams', 'Wilson', 'Johnson', 'Davies', 'Patel',
  'Robinson', 'Wright', 'Thompson', 'Evans', 'Walker', 'White', 'Roberts', 'Green', 'Hall', 'Wood',
  'Jackson', 'Clarke', 'Khan', 'Hughes', 'Edwards', 'Lewis', 'Turner', 'Hill', 'Moore', 'Cooper', 'Ward'];

const TRAINERS = [
  { name: 'Priya Sharma', email: 'priya.sharma@acme.example', phone: '020 7946 0101', specializations: ['Finance'], bio: 'Chartered accountant; leads the finance stream.' },
  { name: 'Marcus Reid', email: 'marcus.reid@acme.example', phone: '0161 496 0102', specializations: ['Procurement', 'Supply Chain'], bio: 'Former buyer and warehouse lead.' },
  { name: 'Hannah Okafor', email: 'hannah.okafor@acme.example', phone: '0113 496 0103', specializations: ['HR'], bio: 'HR systems specialist.' },
  { name: 'Tom Whitfield', email: 'tom.whitfield@acme.example', phone: '020 7946 0104', specializations: ['Finance', 'Procurement', 'Supply Chain', 'HR'], bio: 'Super user who can cover any stream.' }
];

const FIRST_USER_ID = 100001;

// How many people each location should have per role. Sized against the capacities above so
// courses land on both sides of a class: London (12 seats, 2 rooms) gets exactly-full, over-full
// and 25+ attendee courses (several sessions, parallel classrooms); Manchester (10 seats, 1 room)
// needs many sessions in sequence.
const PEOPLE = {
  London: { 'Finance Manager': 2, 'Accounts Payable Clerk': 10, 'Buyer': 7, 'Warehouse Supervisor': 7, 'Store Manager': 9, 'HR Advisor': 5 },
  Manchester: { 'Finance Manager': 3, 'Accounts Payable Clerk': 12, 'Buyer': 9, 'Warehouse Supervisor': 9, 'Store Manager': 12, 'HR Advisor': 5 }
};

// Exceptions to the role baseline: people who need a course outside their role
const INDIVIDUAL = [
  { personIndex: 1, course: 'ACME-FIN-201', notes: 'Covering month-end for Finance Manager' },
  { personIndex: 6, course: 'ACME-FIN-102', notes: 'Backup invoice processing' },
  { personIndex: 12, course: 'ACME-HR-201', notes: 'Site HR champion' },
  { personIndex: 20, course: 'ACME-PRC-201', notes: 'Approves supplier POs locally' },
  { personIndex: 31, course: 'ACME-SCM-201', notes: 'Moving to warehouse role' }
];

// Adds the shortfall for each location + role; new people get the next free ids
const topUpPeople = async (client, projectId) => {
  const { rows: existing } = await client.query(
    'SELECT training_location, project_role, count(*)::int AS n FROM public.end_users WHERE project_id = $1 GROUP BY 1, 2',
    [projectId]);
  const have = new Map(existing.map((r) => [`${r.training_location}|${r.project_role}`, r.n]));
  const { rows: [{ max }] } = await client.query('SELECT max(id) FROM public.end_users');
  let nextId = Math.max(FIRST_USER_ID, (max ?? 0) + 1);

  let added = 0;
  for (const [location, roles] of Object.entries(PEOPLE)) {
    for (const [role, target] of Object.entries(roles)) {
      const missing = target - (have.get(`${location}|${role}`) || 0);
      for (let i = 0; i < missing; i++) {
        const id = nextId++;
        const n = id - FIRST_USER_ID;
        const first = FIRST[n % FIRST.length];
        const last = LAST[(n * 7) % LAST.length];
        added += await insertIfMissing(client, 'end_users', { id }, {
          name: `${first} ${last}`,
          email: `${first}.${last}${n}@acme.example`.toLowerCase(),
          job_title: role,
          country: 'United Kingdom',
          division: ROLES[role].division,
          sub_division: location,
          location_name: `${location} Office`,
          training_location: location,
          project_role: role,
          project_id: projectId
        });
      }
    }
  }
  return added;
};

const insertIfMissing = async (client, table, match, values) => {
  const all = { ...match, ...values };
  const cols = Object.keys(all);
  // The match values get their own parameters so Postgres types each use separately
  const where = Object.keys(match).map((k, i) => `"${k}" = $${cols.length + i + 1}`).join(' AND ');
  const { rowCount } = await client.query(
    `INSERT INTO public.${table} (${cols.map((c) => `"${c}"`).join(', ')})
     SELECT ${cols.map((_, i) => `$${i + 1}`).join(', ')}
     WHERE NOT EXISTS (SELECT 1 FROM public.${table} WHERE ${where})`,
    [...cols.map((c) => all[c]), ...Object.values(match)]);
  return rowCount;
};

export const seedTnaDemo = async ({ projectTitle, connectionString = databaseUrl(), log = console.log }) => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT id, training_data_source FROM public.projects WHERE title = $1 OR name = $1', [projectTitle]);
    if (rows.length !== 1) throw new Error(`Expected one project titled "${projectTitle}", found ${rows.length}`);
    const { id: projectId, training_data_source: source } = rows[0];
    if (source !== 'app') {
      throw new Error(`"${projectTitle}" uses training data source '${source}'. Set it to "Managed in app" first.`);
    }

    await client.query('BEGIN');
    const added = {};
    const count = (table, n) => { added[table] = (added[table] || 0) + n; };

    for (const [i, name] of FUNCTIONAL_AREAS.entries()) {
      count('functional_areas', await insertIfMissing(client, 'functional_areas',
        { project_id: projectId, name }, { display_order: i + 1, active: true }));
    }
    for (const [i, loc] of LOCATIONS.entries()) {
      count('training_locations', await insertIfMissing(client, 'training_locations',
        { project_id: projectId, name: loc.name },
        { capacity: loc.capacity, classrooms_count: loc.classrooms_count, display_order: i + 1, active: true }));
    }
    for (const [i, role] of Object.keys(ROLES).entries()) {
      count('project_roles', await insertIfMissing(client, 'project_roles',
        { project_id: projectId, project_role_name: role }, { display_order: i + 1, active: true }));
    }
    for (const [course_id, course_name, functional_area, duration_hrs, priority] of COURSES) {
      count('courses', await insertIfMissing(client, 'courses', { course_id },
        { course_name, functional_area, duration_hrs, priority, application: 'ACME ERP', project_id: projectId }));
    }
    for (const [role, { courses }] of Object.entries(ROLES)) {
      for (const course_id of courses) {
        count('role_course_mappings', await insertIfMissing(client, 'role_course_mappings',
          { project_id: projectId, project_role_name: role, course_id }, {}));
      }
    }
    count('end_users', await topUpPeople(client, projectId));
    for (const { personIndex, course, notes } of INDIVIDUAL) {
      const end_user_id = FIRST_USER_ID + personIndex;
      const { rowCount } = await client.query(
        'SELECT 1 FROM public.end_users WHERE id = $1 AND project_id = $2', [end_user_id, projectId]);
      if (!rowCount) continue; // that person was deleted
      count('user_course_mappings', await insertIfMissing(client, 'user_course_mappings',
        { end_user_id, course_id: course },
        { project_id: projectId, assigned_by: 'admin', notes }));
    }
    for (const { name, ...trainer } of TRAINERS) {
      count('trainers', await insertIfMissing(client, 'trainers', { project_id: projectId, name }, trainer));
    }
    await client.query('COMMIT');

    for (const [table, n] of Object.entries(added)) log(`  ${table}: ${n} added`);
    const { rows: [summary] } = await client.query(
      `SELECT count(DISTINCT user_id) AS people, count(DISTINCT course_id) AS courses, count(*) AS assignments
       FROM public.training_data_combined WHERE project_id = $1`, [projectId]);
    log(`✓ "${projectTitle}": ${summary.people} people, ${summary.courses} courses, ${summary.assignments} person-course assignments`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const projectTitle = process.argv[2];
  if (!projectTitle) {
    console.error('Usage: npm run db:seed-tna -- "<project title>"');
    process.exit(1);
  }
  const { withDatabase } = await import('../scripts/local/withDatabase.js');
  await withDatabase(() => seedTnaDemo({ projectTitle }));
}
