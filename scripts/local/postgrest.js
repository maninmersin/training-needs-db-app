// Launches tools/postgrest.exe (the same REST engine Supabase uses) against the database.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, config, authenticatorUrl } from './config.js';

const exe = path.join(ROOT, 'tools', process.platform === 'win32' ? 'postgrest.exe' : 'postgrest');
// PostgREST needs libpq; the embedded PostgreSQL package ships it
const pgBin = path.join(ROOT, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin');

export const startPostgrest = () => {
  if (!fs.existsSync(exe)) {
    throw new Error(`PostgREST not found at ${exe}. Run: npm run setup:postgrest`);
  }
  const child = spawn(exe, [], {
    env: {
      ...process.env,
      PATH: `${pgBin}${path.delimiter}${process.env.PATH}`,
      PGRST_DB_URI: authenticatorUrl(),
      PGRST_DB_SCHEMAS: 'public',
      PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: config.jwtSecret,
      PGRST_SERVER_HOST: '127.0.0.1',
      PGRST_SERVER_PORT: String(config.postgrestPort),
      PGRST_DB_EXTRA_SEARCH_PATH: 'public, extensions',
      PGRST_DB_MAX_ROWS: '1000', // Supabase's default cap
      PGRST_LOG_LEVEL: 'error'
    },
    stdio: ['ignore', 'inherit', 'inherit']
  });
  console.log(`✓ PostgREST on http://localhost:${config.postgrestPort}`);
  return child;
};
