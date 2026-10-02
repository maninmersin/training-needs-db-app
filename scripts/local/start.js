// npm run local - starts everything needed to run the app with no cloud services:
//   PostgreSQL (embedded, unless DATABASE_URL is set) -> migrations -> PostgREST -> auth server -> Vite
// Ctrl+C stops it all.
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, config, DATA_HOME } from './config.js';
import { startEmbeddedDb } from './embeddedDb.js';
import { startPostgrest } from './postgrest.js';
import { migrate } from '../../db/migrate.js';
import { startAuthServer } from '../../server/auth/index.js';

process.env.VITE_DB_BACKEND = 'local';

const portInUse = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });

// On Windows child.kill() only ends the direct child (e.g. the cmd shell, not Vite under it)
const killTree = (child) => {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill();
};

const children = [];
let db = null;
let authServer = null;
let stopping = false;

const stop = async (code = 0) => {
  if (stopping) return;
  stopping = true;
  console.log('\nStopping local stack...');
  children.forEach(killTree);
  authServer?.close();
  if (db) await db.stop().catch(() => {});
  process.exit(code);
};
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

try {
  for (const [name, port] of [['PostgREST', config.postgrestPort], ['auth server', config.authPort]]) {
    if (await portInUse(port)) {
      throw new Error(`Port ${port} (${name}) is already in use - is another "npm run local" still running?`);
    }
  }

  if (config.externalDatabaseUrl) {
    console.log('Using DATABASE_URL');
  } else if (await portInUse(config.dbPort)) {
    // Left running by an earlier session that was closed abruptly - reuse it
    console.log(`✓ PostgreSQL already running on port ${config.dbPort}`);
  } else {
    db = await startEmbeddedDb();
    console.log(`✓ PostgreSQL on port ${config.dbPort} (data in ${DATA_HOME})`);
  }

  await migrate();
  children.push(startPostgrest());
  authServer = await startAuthServer();

  const vite = spawn('npx vite', {
    cwd: ROOT,
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DB_BACKEND: 'local',
      VITE_API_URL: `http://localhost:${config.postgrestPort}`,
      VITE_AUTH_URL: `http://localhost:${config.authPort}`
    }
  });
  children.push(vite);
  vite.on('exit', (code) => stop(code ?? 0));
} catch (err) {
  console.error(`✗ ${err.message}`);
  await stop(1);
}
