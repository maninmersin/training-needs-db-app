// Integration test for the local backend: npm run test:local-stack
//
// Spins up a throwaway PostgreSQL + PostgREST + auth server on spare ports with a fixture
// schema, then exercises them through the app's real client code. Never touches your
// local database (uses a temp data dir) and needs no network or Supabase account.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tna-local-stack-'));
Object.assign(process.env, {
  LOCAL_DATA_DIR: tmp,
  LOCAL_DB_PORT: '54391',
  POSTGREST_PORT: '3991',
  AUTH_PORT: '4991',
  VITE_DB_BACKEND: 'local'
});
delete process.env.DATABASE_URL;

// Imported after env is set, because config is read at load time
const { default: pg } = await import('pg');
const { PostgrestClient } = await import('@supabase/postgrest-js');
const { config, ROOT } = await import('../../scripts/local/config.js');
const { startEmbeddedDb } = await import('../../scripts/local/embeddedDb.js');
const { startPostgrest } = await import('../../scripts/local/postgrest.js');
const { migrate } = await import('../../db/migrate.js');
const { seed } = await import('../../db/seed.js');
const { cleanDump, pullData } = await import('../../db/pull-from-supabase.js');
const { startAuthServer } = await import('../../server/auth/index.js');
const { createLocalAuthClient } = await import('../../src/core/services/localAuthClient.js');

const AUTH = `http://localhost:${config.authPort}`;
const API = `http://localhost:${config.postgrestPort}`;
const base = `postgresql://postgres:${encodeURIComponent(config.superuserPassword)}@127.0.0.1:${config.dbPort}`;

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

const client = () => {
  const auth = createLocalAuthClient(AUTH);
  const authedFetch = async (input, init = {}) => {
    const token = await auth.getAccessToken();
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };
  return { auth, db: new PostgrestClient(API, { fetch: authedFetch }) };
};

const authRequest = (urlPath, body, token, method = 'POST') =>
  fetch(AUTH + urlPath, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });

const query = async (database, sql, params) => {
  const c = new pg.Client({ connectionString: `${base}/${database}` });
  await c.connect();
  try {
    return await c.query(sql, params);
  } finally {
    await c.end();
  }
};

// Migrations = real compat layer + fixture schema standing in for the Supabase baseline
const migrationsDir = path.join(tmp, 'migrations');
fs.mkdirSync(migrationsDir);
fs.copyFileSync(path.join(ROOT, 'db', 'migrations', '0000_supabase_compat.sql'), path.join(migrationsDir, '0000_supabase_compat.sql'));
fs.copyFileSync(path.join(HERE, 'fixture_0001_baseline.sql'), path.join(migrationsDir, '0001_baseline.sql'));

let db;
let rest;
let authServer;

try {
  console.log('Schema clean-up');
  await test('Supabase-only statements removed from dumps', async () => {
    const raw = [
      `SELECT pg_catalog.set_config('search_path', '', false);`,
      `CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";`,
      `CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";`,
      `CREATE SCHEMA "public";`,
      `ALTER SCHEMA "public" OWNER TO "pg_database_owner";`,
      `CREATE TABLE "public"."t" ("id" int);`,
      `ALTER TABLE "public"."t" OWNER TO "postgres";`,
      `ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."t";`,
      `GRANT ALL ON TABLE "public"."t" TO "supabase_admin";`,
      `ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "dashboard_user";`
    ].join('\n');
    const { sql, dropped } = cleanDump(raw);
    assert.match(sql, /CREATE TABLE "public"\."t"/);
    assert.match(sql, /CREATE SCHEMA IF NOT EXISTS public;/);
    assert.match(sql, /set_config\('search_path', 'public, extensions', false\)/);
    for (const gone of ['pg_graphql', 'OWNER TO', 'PUBLICATION', 'GRANT', 'DEFAULT PRIVILEGES', 'uuid-ossp']) {
      assert.ok(!sql.includes(gone), `should remove ${gone}`);
    }
    assert.deepEqual(dropped.sort(), ['extension pg_graphql', 'realtime publication']);
  });

  console.log('Database + migrations');
  db = await startEmbeddedDb();
  await test('migrations apply to an empty database', async () => {
    await migrate({ log: () => {}, migrationsDir });
  });
  await test('re-running migrations is a no-op', async () => {
    const lines = [];
    await migrate({ log: (l) => lines.push(l), migrationsDir });
    assert.deepEqual(lines, ['✓ database schema is up to date']);
  });
  await seed({ email: 'admin@local.test', password: 'AdminPassw0rd' });

  rest = startPostgrest();
  authServer = await startAuthServer();
  for (let i = 0; i < 50; i++) {
    if ((await fetch(`${API}/`).catch(() => null))?.ok) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log('Auth + row-level security');
  const admin = client();
  const events = [];
  admin.auth.onAuthStateChange((e) => events.push(e));

  await test('wrong password rejected', async () => {
    const { error } = await admin.auth.signInWithPassword({ email: 'admin@local.test', password: 'nope' });
    assert.equal(error.message, 'Invalid login credentials');
  });
  await test('login works (email case-insensitive)', async () => {
    const { data, error } = await admin.auth.signInWithPassword({ email: 'ADMIN@local.test', password: 'AdminPassw0rd' });
    assert.ifError(error);
    assert.ok(data.session.access_token);
    assert.equal((await admin.auth.getUser()).data.user.email, 'admin@local.test');
  });
  const { data: projects } = await admin.db.from('projects').select('id');
  const projectId = projects?.[0]?.id;
  await test('member sees own project; can write to it', async () => {
    assert.equal(projects.length, 1);
    const { error } = await admin.db.from('end_users').insert({ project_id: projectId, name: 'Alice' });
    assert.ifError(error);
  });
  await test('filters, ordering, embedded joins, rpc', async () => {
    const { data } = await admin.db.from('end_users').select('name').eq('project_id', projectId).order('name');
    assert.deepEqual(data.map((d) => d.name), ['Alice']);
    const { data: roles } = await admin.db.from('auth_user_roles').select('role_id, auth_roles(name)');
    assert.equal(roles[0].auth_roles.name, 'admin');
    const { data: count } = await admin.db.rpc('get_my_project_count');
    assert.equal(count, 1);
  });
  await test('anonymous requests see nothing', async () => {
    const { data } = await new PostgrestClient(API).from('end_users').select('*');
    assert.equal(data.length, 0);
  });

  const adminToken = await admin.auth.getAccessToken();
  let bobId;
  await test('admin API: create, duplicate, weak password', async () => {
    const created = await authRequest('/admin/users', { email: 'bob@local.test', password: 'BobPassw0rd' }, adminToken);
    assert.equal(created.status, 201);
    bobId = (await created.json()).user.id;
    assert.equal((await authRequest('/admin/users', { email: 'bob@local.test', password: 'BobPassw0rd' }, adminToken)).status, 409);
    assert.equal((await authRequest('/admin/users', { email: 'x@local.test', password: 'short' }, adminToken)).status, 400);
  });

  const bob = client();
  await test('non-member is isolated by RLS', async () => {
    assert.ifError((await bob.auth.signInWithPassword({ email: 'bob@local.test', password: 'BobPassw0rd' })).error);
    assert.equal((await bob.db.from('projects').select('*')).data.length, 0);
    assert.equal((await bob.db.from('end_users').select('*')).data.length, 0);
    assert.ok((await bob.db.from('end_users').insert({ project_id: projectId, name: 'Mallory' })).error);
  });
  await test('admin API refuses non-admins and anonymous callers', async () => {
    const bobToken = await bob.auth.getAccessToken();
    assert.equal((await authRequest('/admin/users', { email: 'z@local.test', password: 'Zpassw0rd1' }, bobToken)).status, 403);
    assert.equal((await authRequest('/admin/users', {})).status, 401);
  });
  await test('PostgREST rejects forged tokens', async () => {
    const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4Iiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ.AAAA';
    const res = await fetch(`${API}/projects`, { headers: { Authorization: `Bearer ${forged}` } });
    assert.equal(res.status, 401);
  });
  await test('password change revokes existing refresh tokens', async () => {
    const { refresh_token } = (await bob.auth.getSession()).data.session;
    assert.equal((await authRequest(`/admin/users/${bobId}`, { password: 'NewBobPass1' }, adminToken, 'PUT')).status, 200);
    assert.equal((await authRequest('/token?grant_type=refresh_token', { refresh_token })).status, 400);
  });
  await test('refresh tokens are single-use', async () => {
    const { refresh_token } = (await admin.auth.getSession()).data.session;
    assert.equal((await authRequest('/token?grant_type=refresh_token', { refresh_token })).status, 200);
    assert.equal((await authRequest('/token?grant_type=refresh_token', { refresh_token })).status, 400);
  });
  await test('admin cannot delete self; can delete others', async () => {
    const me = (await admin.auth.getUser()).data.user.id;
    assert.equal((await authRequest(`/admin/users/${me}`, null, adminToken, 'DELETE')).status, 400);
    assert.equal((await authRequest(`/admin/users/${bobId}`, null, adminToken, 'DELETE')).status, 200);
  });
  await test('account and migration tables are not exposed', async () => {
    assert.ok((await admin.db.schema('auth').from('users').select('*')).error);
    assert.ok((await admin.db.schema('migrations').from('applied').select('*')).error);
  });
  await test('sign-out fires auth events', async () => {
    await admin.auth.signOut();
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(events.filter((e) => e !== 'INITIAL_SESSION'), ['SIGNED_IN', 'SIGNED_OUT']);
  });

  console.log('Copy from Supabase (simulated with a second local database)');
  await query('postgres', 'DROP DATABASE IF EXISTS fake_supabase');
  await query('postgres', 'CREATE DATABASE fake_supabase');
  await migrate({ log: () => {}, connectionString: `${base}/fake_supabase`, migrationsDir });
  await query('fake_supabase', `
    ALTER TABLE auth.users ADD COLUMN deleted_at timestamptz;
    INSERT INTO auth.users (id, email, encrypted_password) VALUES
      ('11111111-1111-1111-1111-111111111111', 'real@co.com', crypt('RealPass123', gen_salt('bf'))),
      ('22222222-2222-2222-2222-222222222222', 'gone@co.com', crypt('GonePass123', gen_salt('bf')));
    UPDATE auth.users SET deleted_at = now() WHERE email = 'gone@co.com';
    INSERT INTO auth_users VALUES ('11111111-1111-1111-1111-111111111111', 'real@co.com', 'auth_managed', true);
    INSERT INTO auth_roles (name) VALUES ('admin');
    INSERT INTO projects (id, name) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Real Project');
    INSERT INTO project_users (project_id, user_id, role)
      VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner');
    INSERT INTO end_users (project_id, name)
      SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'User ' || g FROM generate_series(1, 1234) g;`);

  await test('pull-data copies rows and logins', async () => {
    process.env.SUPABASE_DB_URL = `${base}/fake_supabase`;
    const log = console.log;
    console.log = () => {};
    try {
      await pullData();
    } finally {
      console.log = log;
    }
  });
  const real = client();
  await test('copied login works with its original password; deleted account skipped', async () => {
    assert.ifError((await real.auth.signInWithPassword({ email: 'real@co.com', password: 'RealPass123' })).error);
    assert.ok((await createLocalAuthClient(AUTH).signInWithPassword({ email: 'gone@co.com', password: 'GonePass123' })).error);
  });
  await test('row cap of 1000 matches Supabase; counts are exact', async () => {
    assert.equal((await real.db.from('end_users').select('id')).data.length, 1000);
    assert.equal((await real.db.from('end_users').select('*', { count: 'exact', head: true })).count, 1234);
  });
  await test('sequences continue after copied ids', async () => {
    const { data, error } = await real.db.from('end_users')
      .insert({ project_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'New' }).select().single();
    assert.ifError(error);
    assert.equal(data.id, 1235);
  });

  console.log(`\n${passed} passed`);
} catch (err) {
  console.error('\n✗ FAILED:', err);
  process.exitCode = 1;
} finally {
  rest && (process.platform === 'win32'
    ? (await import('node:child_process')).spawnSync('taskkill', ['/PID', String(rest.pid), '/T', '/F'], { stdio: 'ignore' })
    : rest.kill());
  authServer?.close();
  if (db) await db.stop().catch(() => {});
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(process.exitCode || 0);
}
