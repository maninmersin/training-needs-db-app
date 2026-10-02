// One-off copy from Supabase to local PostgreSQL.
//
//   npm run db:pull-schema   -> writes db/migrations/0001_baseline.sql (structure only, safe to commit)
//   npm run db:pull-data     -> copies all public-table rows and login accounts into the local DB
//                               (data never touches the repo or any file)
//
// Needs SUPABASE_DB_URL in .env.local - the "Session pooler" connection string from
// Supabase dashboard > Connect, with your database password filled in.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { ROOT, databaseUrl } from '../scripts/local/config.js';

const BASELINE = path.join(ROOT, 'db', 'migrations', '0001_baseline.sql');

const sourceUrl = () => {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    throw new Error(
      'SUPABASE_DB_URL is not set. Add it to .env.local (Supabase dashboard > Connect > Session pooler,\n' +
      '  with your database password filled in). .env.local is git-ignored.'
    );
  }
  return url;
};

const hasCommand = (cmd, args = ['--version']) => spawnSync(cmd, args, { shell: true, stdio: 'ignore' }).status === 0;

// --- schema --------------------------------------------------------------------------------

const dumpSchemaRaw = (url, outFile) => {
  const pgDump = process.env.PG_DUMP || 'pg_dump';
  if (hasCommand(pgDump)) {
    console.log(`Using ${pgDump}`);
    const r = spawnSync(pgDump, ['--schema-only', '--schema=public', '--no-owner', '--no-privileges', '--file', outFile, url], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('pg_dump failed (it must be version 17 or newer to read Supabase).');
    return;
  }
  if (hasCommand('docker', ['info'])) {
    console.log('pg_dump not found - using the Supabase CLI (runs pg_dump inside Docker)');
    const r = spawnSync('npx', ['--yes', 'supabase@latest', 'db', 'dump', '--db-url', url, '--schema', 'public', '-f', outFile], { stdio: 'inherit', shell: true });
    if (r.status !== 0) throw new Error('supabase db dump failed.');
    return;
  }
  throw new Error(
    'Need either pg_dump (v17+) on PATH, or Docker Desktop running. Options:\n' +
    '  - Start Docker Desktop and re-run, or\n' +
    '  - Download the PostgreSQL 17 "zip archive" binaries from https://www.enterprisedb.com/download-postgresql-binaries,\n' +
    '    unzip anywhere, then: set PG_DUMP=C:\\path\\to\\pgsql\\bin\\pg_dump.exe'
  );
};

// Removes Supabase-platform statements that don't apply to plain PostgreSQL.
// Grants are re-created uniformly by db/post-migrate.sql.
export const cleanDump = (sql) => {
  const dropped = new Set();
  const keepExtensions = new Set(['uuid-ossp', 'pgcrypto']);
  const lines = sql.split(/\r?\n/).filter((line) => {
    const t = line.trim();
    const ext = t.match(/^(?:CREATE EXTENSION(?: IF NOT EXISTS)?|COMMENT ON EXTENSION) "?([\w-]+)"?/i);
    if (ext) {
      if (!keepExtensions.has(ext[1])) dropped.add(`extension ${ext[1]}`);
      return false; // uuid-ossp/pgcrypto come from 0000_supabase_compat.sql
    }
    if (/^(GRANT|REVOKE|ALTER DEFAULT PRIVILEGES)\b/i.test(t)) return false;
    if (/^ALTER .* OWNER TO /i.test(t)) return false;
    if (/^ALTER PUBLICATION\b/i.test(t)) { dropped.add('realtime publication'); return false; }
    if (/^\\(un)?restrict\b/.test(t)) return false; // psql meta-commands from newer pg_dump
    return true;
  });
  let out = lines.join('\n')
    .replace(/^CREATE SCHEMA (?:IF NOT EXISTS )?"?public"?;$/gim, 'CREATE SCHEMA IF NOT EXISTS public;')
    .replace(/^COMMENT ON SCHEMA "?public"? IS .*$/gim, '');
  // Keep the search_path that compat sets up (dumps blank it out)
  out = out.replace(/SELECT pg_catalog\.set_config\('search_path', '', false\);/g,
    `SELECT pg_catalog.set_config('search_path', 'public, extensions', false);`);
  return { sql: out, dropped: [...dropped] };
};

export const pullSchema = async () => {
  const url = sourceUrl();
  const tmp = path.join(os.tmpdir(), `tna-schema-${Date.now()}.sql`);
  try {
    dumpSchemaRaw(url, tmp);
    const { sql, dropped } = cleanDump(fs.readFileSync(tmp, 'utf8'));
    const header =
      `-- Baseline schema pulled from Supabase on ${new Date().toISOString().slice(0, 10)} by db/pull-from-supabase.js\n` +
      `-- Structure only (no data). Do not edit - add new numbered migrations instead.\n\n`;
    fs.writeFileSync(BASELINE, header + sql);
    console.log(`✓ wrote ${path.relative(ROOT, BASELINE)} (${sql.split('\n').length} lines)`);
    if (dropped.length) console.log(`  Removed Supabase-only items: ${dropped.join(', ')}`);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
};

// --- data ----------------------------------------------------------------------------------

const BATCH = 500;

export const pullData = async () => {
  const src = sourceUrl();
  // Supabase requires TLS; a local/company server on localhost may not offer it
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(new URL(src).hostname);
  const source = new pg.Client({ connectionString: src, ssl: isLocalHost ? false : { rejectUnauthorized: false } });
  const target = new pg.Client({ connectionString: databaseUrl() });
  await source.connect();
  await target.connect();
  try {
    const { rows: tables } = await target.query(`
      SELECT c.relname AS name
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
      ORDER BY 1`);
    if (!tables.length) throw new Error('Local database has no tables - run npm run db:migrate first.');

    await target.query('BEGIN');
    // Load in any order: skip FK checks and triggers for this transaction only
    await target.query('SET LOCAL session_replication_role = replica');

    // Login accounts: Supabase stores bcrypt hashes, which server/auth verifies as-is
    const { rows: users } = await source.query(`
      SELECT id, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
             raw_user_meta_data, last_sign_in_at, banned_until, created_at, updated_at
      FROM auth.users WHERE deleted_at IS NULL`);
    await target.query('TRUNCATE auth.users CASCADE');
    for (let i = 0; i < users.length; i += BATCH) {
      await target.query(
        'INSERT INTO auth.users SELECT * FROM json_populate_recordset(null::auth.users, $1)',
        [JSON.stringify(users.slice(i, i + BATCH))]
      );
    }
    console.log(`  auth.users: ${users.length} login(s)`);

    await target.query(`TRUNCATE ${tables.map((t) => `public."${t.name}"`).join(', ')} CASCADE`);

    let total = 0;
    for (const { name } of tables) {
      const exists = await source.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`, [name]);
      if (!exists.rowCount) { console.log(`  ${name}: not in Supabase, skipped`); continue; }

      // Generated columns can't be inserted; they recompute themselves
      const { rows: cols } = await target.query(`
        SELECT a.attname FROM pg_attribute a
        WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
        ORDER BY a.attnum`, [`public."${name}"`]);
      const colList = cols.map((c) => `"${c.attname}"`).join(', ');

      const { rows } = await source.query(`SELECT ${colList} FROM public."${name}"`);
      for (let i = 0; i < rows.length; i += BATCH) {
        await target.query(
          `INSERT INTO public."${name}" (${colList}) OVERRIDING SYSTEM VALUE
           SELECT ${colList} FROM json_populate_recordset(null::public."${name}", $1)`,
          [JSON.stringify(rows.slice(i, i + BATCH))]
        );
      }
      total += rows.length;
      console.log(`  ${name}: ${rows.length}`);
    }

    // Move sequences past the copied ids
    const { rows: seqs } = await target.query(`
      SELECT format('%I.%I', sn.nspname, s.relname) AS seq, format('%I.%I', tn.nspname, t.relname) AS tbl, a.attname AS col
      FROM pg_depend d
      JOIN pg_class s ON s.oid = d.objid AND s.relkind = 'S'
      JOIN pg_namespace sn ON sn.oid = s.relnamespace
      JOIN pg_class t ON t.oid = d.refobjid
      JOIN pg_namespace tn ON tn.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
      WHERE tn.nspname = 'public' AND d.deptype IN ('a','i')`);
    for (const { seq, tbl, col } of seqs) {
      await target.query(`SELECT setval('${seq}', coalesce((SELECT max("${col}") FROM ${tbl}), 0) + 1, false)`);
    }

    await target.query('COMMIT');
    console.log(`✓ copied ${total} rows from ${tables.length} tables and ${users.length} logins`);
  } catch (err) {
    await target.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await source.end();
    await target.end();
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  if (mode === 'schema') {
    await pullSchema().catch((err) => { console.error(`✗ ${err.message}`); process.exitCode = 1; });
  } else if (mode === 'data') {
    const { withDatabase } = await import('../scripts/local/withDatabase.js');
    await withDatabase(pullData);
  } else {
    console.error('Usage: node db/pull-from-supabase.js schema|data');
    process.exitCode = 1;
  }
}
