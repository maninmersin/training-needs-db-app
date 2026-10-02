// Applies db/migrations/*.sql in filename order, once each, recording them in
// migrations.applied. Then applies db/post-migrate.sql (grants, idempotent).
//
//   npm run db:migrate             (uses the embedded DB, starting it if needed)
//   DATABASE_URL=... npm run db:migrate   (any PostgreSQL server)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { ROOT, config, databaseUrl } from '../scripts/local/config.js';

const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations');
const POST_MIGRATE = path.join(ROOT, 'db', 'post-migrate.sql');

const checksum = (sql) => crypto.createHash('sha256').update(sql).digest('hex');

export const migrate = async ({ log = console.log, connectionString = databaseUrl(), migrationsDir = MIGRATIONS_DIR } = {}) => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    // Kept outside "public" so PostgREST never exposes it
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS migrations;
      CREATE TABLE IF NOT EXISTS migrations.applied (
        filename    text PRIMARY KEY,
        checksum    text NOT NULL,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )`);

    const { rows } = await client.query('SELECT filename, checksum FROM migrations.applied');
    const applied = new Map(rows.map((r) => [r.filename, r.checksum]));

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    if (!files.some((f) => f.startsWith('0001_'))) {
      log('⚠  No 0001_baseline.sql found - only the compatibility layer will be created.');
      log('   Pull the real schema first: see LOCAL_SETUP.md, "Copy the schema from Supabase".');
    }

    let count = 0;
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const sum = checksum(sql);
      if (applied.has(file)) {
        if (applied.get(file) !== sum) {
          log(`⚠  ${file} has changed since it was applied - not re-running. Add a new migration instead.`);
        }
        continue;
      }
      log(`→ applying ${file}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO migrations.applied (filename, checksum) VALUES ($1, $2)', [file, sum]);
        await client.query('COMMIT');
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}${err.position ? ` (at character ${err.position})` : ''}`);
      }
    }

    await client.query(fs.readFileSync(POST_MIGRATE, 'utf8'));
    // PostgREST logs in as authenticator; keep its password in sync with local config
    await client.query(`ALTER ROLE authenticator WITH LOGIN PASSWORD '${config.authenticatorPassword.replace(/'/g, "''")}'`);

    log(count ? `✓ ${count} migration(s) applied` : '✓ database schema is up to date');
  } finally {
    await client.end();
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withDatabase } = await import('../scripts/local/withDatabase.js');
  await withDatabase(() => migrate());
}
