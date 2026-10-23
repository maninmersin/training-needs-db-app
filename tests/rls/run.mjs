// Row-level security test: npm run test:rls
//
// Applies ALL the real migrations to a throwaway PostgreSQL (temp data dir, spare port) and checks, as an
// owner, an admin, a member, a viewer, an outsider and an anonymous caller, who can see and change what.
// Never touches your local database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tna-rls-'));
Object.assign(process.env, { LOCAL_DATA_DIR: tmp, LOCAL_DB_PORT: '54393', VITE_DB_BACKEND: 'local' });
delete process.env.DATABASE_URL;

const { default: pg } = await import('pg');
const { config } = await import('../../scripts/local/config.js');
const { startEmbeddedDb } = await import('../../scripts/local/embeddedDb.js');
const { migrate } = await import('../../db/migrate.js');

const ids = {
  owner: '00000000-0000-0000-0000-00000000000a',
  admin: '00000000-0000-0000-0000-00000000000b',
  member: '00000000-0000-0000-0000-00000000000c',
  viewer: '00000000-0000-0000-0000-00000000000d',
  outsider: '00000000-0000-0000-0000-00000000000e',
  creator: '00000000-0000-0000-0000-00000000000f'
};
const P1 = '11111111-1111-1111-1111-111111111111';
const P2 = '22222222-2222-2222-2222-222222222222';
const P3 = '33333333-3333-3333-3333-333333333333';

let db;
let admin; // superuser connection (bypasses row security)
let url;
let passed = 0;

// Run `fn` as a signed-in user (or anonymous when userId is null), the way PostgREST does
const as = async (userId, fn) => {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query(userId ? 'SET LOCAL ROLE authenticated' : 'SET LOCAL ROLE anon');
    if (userId) await c.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const result = await fn((sql, params) => c.query(sql, params));
    await c.query('ROLLBACK'); // nothing a test does is kept
    return result;
  } finally {
    await c.end();
  }
};
// A statement that row security refuses raises an error; one that matches no visible row changes nothing
const refused = (userId, sql, params) => as(userId, async (q) => {
  try { await q(sql, params); return false; } catch (e) { return /row-level security|permission denied/.test(e.message); }
});
const count = (userId, table, project) => as(userId, async (q) => (await q(`SELECT count(*)::int n FROM ${table} WHERE project_id = $1`, [project])).rows[0].n);
const changed = (userId, sql, params) => as(userId, async (q) => (await q(sql, params)).rowCount);
const statsFor = (userId, project) => as(userId, async (q) => (await q('SELECT * FROM get_training_data_stats($1)', [project])).rows[0].total_assignments);

const test = async (name, fn) => { await fn(); passed++; console.log(`  ✓ ${name}`); };

const trainingRow = "INSERT INTO training_data (project_id, user_id, user_name, course_id, course_name, duration_hrs, training_location, functional_area) VALUES ($1,'9','Z','c9','C9',1,'X','Y')";

try {
  db = await startEmbeddedDb();
  url = `postgresql://postgres:${encodeURIComponent(config.superuserPassword)}@127.0.0.1:${config.dbPort}/postgres`;
  await migrate({ log: () => {}, connectionString: url });
  admin = new pg.Client({ connectionString: url });
  await admin.connect();

  for (const [name, id] of Object.entries(ids)) {
    await admin.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [id, `${name}@x.com`]);
    await admin.query('INSERT INTO auth_users (id, email) VALUES ($1, $2)', [id, `${name}@x.com`]);
  }
  await admin.query("INSERT INTO projects (id, name, title, owner_id, created_by) VALUES ($1,'p1','Project One',$2,$2), ($3,'p2','Project Two',$4,$4)", [P1, ids.owner, P2, ids.outsider]);
  await admin.query(
    `INSERT INTO project_users (project_id, user_id, role) VALUES
      ($1,$2,'owner'), ($1,$3,'admin'), ($1,$4,'member'), ($1,$5,'viewer'), ($6,$7,'owner')`,
    [P1, ids.owner, ids.admin, ids.member, ids.viewer, P2, ids.outsider]
  );
  for (const p of [P1, P2]) {
    await admin.query("INSERT INTO training_data (project_id, user_id, user_name, course_id, course_name, duration_hrs, training_location, functional_area) VALUES ($1,'1','A','c1','C1',2,'Dubai','Finance')", [p]);
    await admin.query("INSERT INTO training_locations (project_id, name) VALUES ($1,'Dubai')", [p]);
    await admin.query("INSERT INTO training_schedules (project_id, name) VALUES ($1,'S')", [p]);
  }

  console.log('Reading');
  await test('every member role reads their own project', async () => {
    for (const who of ['owner', 'admin', 'member', 'viewer']) {
      assert.equal(await count(ids[who], 'training_data', P1), 1, who);
      assert.equal(await count(ids[who], 'training_schedules', P1), 1, who);
    }
  });
  await test('an outsider sees nothing of another project, but still sees their own', async () => {
    for (const table of ['training_data', 'training_locations', 'training_schedules']) {
      assert.equal(await count(ids.outsider, table, P1), 0, table);
      assert.equal(await count(ids.outsider, table, P2), 1, table);
    }
  });
  await test('anonymous callers see nothing', async () => {
    assert.equal(await count(null, 'training_data', P1), 0);
  });
  await test('the combined TNA view follows the same rule', async () => {
    assert.equal(await count(ids.outsider, 'training_data_combined', P1), 0);
    assert.equal(await count(ids.member, 'training_data_combined', P1), 1);
  });
  await test('the statistics function counts only what the caller can see', async () => {
    assert.equal(await statsFor(ids.outsider, P1), 0);
    assert.equal(await statsFor(ids.member, P1), 1);
  });

  console.log('Changing project data');
  await test('owner, admin and member can change data; a viewer cannot', async () => {
    for (const who of ['owner', 'admin', 'member']) {
      assert.equal(await changed(ids[who], "UPDATE training_locations SET name = 'Dubai 2' WHERE project_id = $1", [P1]), 1, who);
      assert.equal(await changed(ids[who], 'DELETE FROM training_schedules WHERE project_id = $1', [P1]), 1, who);
    }
    assert.equal(await changed(ids.viewer, "UPDATE training_locations SET name = 'X' WHERE project_id = $1", [P1]), 0);
    assert.equal(await changed(ids.viewer, 'DELETE FROM training_schedules WHERE project_id = $1', [P1]), 0);
    assert.ok(await refused(ids.viewer, "INSERT INTO training_locations (project_id, name) VALUES ($1, 'New')", [P1]));
  });
  await test('an outsider can neither change nor add data in another project', async () => {
    assert.equal(await changed(ids.outsider, "UPDATE training_data SET user_name = 'Hacked' WHERE project_id = $1", [P1]), 0);
    assert.equal(await changed(ids.outsider, 'DELETE FROM training_data WHERE project_id = $1', [P1]), 0);
    assert.ok(await refused(ids.outsider, "INSERT INTO training_locations (project_id, name) VALUES ($1, 'Evil')", [P1]));
    assert.ok(await refused(ids.outsider, trainingRow, [P1]));
  });
  await test('anonymous callers cannot write', async () => {
    assert.ok(await refused(null, "INSERT INTO training_locations (project_id, name) VALUES ($1, 'Anon')", [P1]));
  });

  console.log('Membership');
  await test('members see who else is in their project; outsiders do not', async () => {
    assert.equal(await count(ids.viewer, 'project_users', P1), 4);
    assert.equal(await count(ids.outsider, 'project_users', P1), 0);
  });
  await test('an outsider cannot add themselves to another project', async () => {
    assert.ok(await refused(ids.outsider, "INSERT INTO project_users (project_id, user_id, role) VALUES ($1, $2, 'owner')", [P1, ids.outsider]));
  });
  await test('a member or viewer cannot add, promote or remove people', async () => {
    for (const who of ['member', 'viewer']) {
      assert.ok(await refused(ids[who], "INSERT INTO project_users (project_id, user_id, role) VALUES ($1, $2, 'member')", [P1, ids.creator]), who);
      assert.equal(await changed(ids[who], "UPDATE project_users SET role = 'owner' WHERE project_id = $1 AND user_id = $2", [P1, ids[who]]), 0, who);
      assert.equal(await changed(ids[who], 'DELETE FROM project_users WHERE project_id = $1 AND user_id = $2', [P1, ids.viewer]), 0, who);
    }
  });
  await test('an owner or admin can add, change and remove members', async () => {
    for (const who of ['owner', 'admin']) {
      await as(ids[who], async (q) => {
        await q("INSERT INTO project_users (project_id, user_id, role) VALUES ($1, $2, 'member')", [P1, ids.creator]);
        assert.equal((await q("UPDATE project_users SET role = 'viewer' WHERE project_id = $1 AND user_id = $2", [P1, ids.creator])).rowCount, 1);
        assert.equal((await q('DELETE FROM project_users WHERE project_id = $1 AND user_id = $2', [P1, ids.creator])).rowCount, 1);
      });
    }
  });
  await test('creating a project works: the creator can add themselves as its owner', async () => {
    await as(ids.creator, async (q) => {
      await q("INSERT INTO projects (id, name, title, owner_id, created_by) VALUES ($1,'p3','Three',$2,$2)", [P3, ids.creator]);
      await q("INSERT INTO project_users (project_id, user_id, role) VALUES ($1, $2, 'owner')", [P3, ids.creator]);
      assert.equal((await q('SELECT count(*)::int n FROM project_users WHERE project_id = $1', [P3])).rows[0].n, 1);
    });
  });
  await test('an owner whose membership row is missing can still use and manage their project', async () => {
    await admin.query('DELETE FROM project_users WHERE project_id = $1 AND user_id = $2', [P2, ids.outsider]);
    assert.equal(await count(ids.outsider, 'training_data', P2), 1);
    await as(ids.outsider, (q) => q("INSERT INTO project_users (project_id, user_id, role) VALUES ($1, $2, 'owner')", [P2, ids.outsider]));
  });

  console.log(`\n${passed} passed`);
} catch (err) {
  console.error('\n✗ FAILED:', err);
  process.exitCode = 1;
} finally {
  if (admin) await admin.end().catch(() => {});
  if (db) await db.stop().catch(() => {});
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(process.exitCode || 0);
}
