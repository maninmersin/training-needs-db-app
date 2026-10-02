// Starts the auth server.  npm run auth-server   (or as part of npm run local)
// Mode follows VITE_DB_BACKEND: local -> full auth against local Postgres;
// supabase -> admin endpoints only, using SUPABASE_SERVICE_ROLE_KEY server-side.
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { config, databaseUrl } from '../../scripts/local/config.js';
import { createAuthApp } from './app.js';

export const startAuthServer = async () => {
  const mode = (process.env.VITE_DB_BACKEND || 'supabase').toLowerCase() === 'local' ? 'local' : 'supabase';
  let app;

  if (mode === 'local') {
    const pool = new pg.Pool({ connectionString: databaseUrl(), max: 5 });
    // A dropped idle connection must not crash the server; the pool reconnects on next use
    pool.on('error', (err) => console.error('[auth] database connection lost:', err.message));
    app = createAuthApp({ pool, config, mode });
  } else {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error('Supabase mode needs VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (no VITE_ prefix) in .env');
    }
    const { createClient } = await import('@supabase/supabase-js');
    const opts = { auth: { autoRefreshToken: false, persistSession: false } };
    app = createAuthApp({
      config,
      mode,
      supabaseAdmin: createClient(config.supabaseUrl, config.supabaseServiceRoleKey, opts),
      supabaseAnon: createClient(config.supabaseUrl, config.supabaseAnonKey, opts)
    });
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(config.authPort, '127.0.0.1', () => {
      console.log(`✓ auth server (${mode} mode) on http://localhost:${config.authPort}`);
      resolve(server);
    });
    server.on('error', reject);
  });
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  startAuthServer().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
