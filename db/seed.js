// npm run db:seed -- creates (or resets the password of) a local admin login and a test
// project, so a fresh local database is usable. Uses fake data only.
//
//   npm run db:seed                                  -> admin@local.test / generated password
//   npm run db:seed -- you@company.com MyPassword1   -> chosen login
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { databaseUrl } from '../scripts/local/config.js';

// The baseline schema comes from Supabase, so only insert columns that actually exist
const insertKnownColumns = async (client, table, values, conflict = 'DO NOTHING') => {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table]);
  if (!rows.length) return null;
  const existing = new Set(rows.map((r) => r.column_name));
  const entries = Object.entries(values).filter(([k]) => existing.has(k));
  const cols = entries.map(([k]) => `"${k}"`).join(', ');
  const params = entries.map((_, i) => `$${i + 1}`).join(', ');
  const res = await client.query(
    `INSERT INTO public."${table}" (${cols}) VALUES (${params}) ON CONFLICT ${conflict} RETURNING *`,
    entries.map(([, v]) => v));
  return res.rows[0] || null;
};

export const seed = async ({ email = 'admin@local.test', password } = {}) => {
  const pwd = password || crypto.randomBytes(9).toString('base64url');
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(pwd, 10);
    const { rows: [user] } = await client.query(
      `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at) VALUES ($1, $2, now())
       ON CONFLICT (email) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password, updated_at = now()
       RETURNING id`,
      [email.toLowerCase(), hash]);

    await insertKnownColumns(client, 'auth_users', {
      id: user.id, email: email.toLowerCase(), password_hash: 'auth_managed',
      is_verified: true, is_active: true, is_super_admin: true
    });

    let role = (await client.query(`SELECT id FROM public.auth_roles WHERE name = 'admin'`).catch(() => ({ rows: [] }))).rows[0];
    if (!role) role = await insertKnownColumns(client, 'auth_roles', { name: 'admin', description: 'Full access' });
    if (role) await insertKnownColumns(client, 'auth_user_roles', { user_id: user.id, role_id: role.id });

    const existingProject = await client.query(
      `SELECT p.id FROM public.projects p JOIN public.project_users pu ON pu.project_id = p.id WHERE pu.user_id = $1 LIMIT 1`,
      [user.id]).catch(() => ({ rows: [] }));
    if (!existingProject.rows.length) {
      const project = await insertKnownColumns(client, 'projects', {
        name: 'Local Test Project', title: 'Local Test Project',
        description: 'Created by db/seed.js', is_active: true, status: 'active', created_by: user.id
      });
      if (project) {
        await insertKnownColumns(client, 'project_users', {
          project_id: project.id, user_id: user.id, role: 'owner', is_active: true
        });
      }
    }
    await client.query('COMMIT');

    console.log('✓ Local login ready');
    console.log(`    email:    ${email.toLowerCase()}`);
    console.log(`    password: ${password ? '(as given)' : pwd}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [email, password] = process.argv.slice(2);
  const { withDatabase } = await import('../scripts/local/withDatabase.js');
  await withDatabase(() => seed({ email, password }));
}
