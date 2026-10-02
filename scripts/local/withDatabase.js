// Runs a task against the database: uses DATABASE_URL if set, otherwise starts the
// embedded server for the duration of the task (unless it's already running).
import net from 'node:net';
import { config } from './config.js';
import { startEmbeddedDb } from './embeddedDb.js';

const portInUse = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });

export const withDatabase = async (task) => {
  let server = null;
  if (!config.externalDatabaseUrl && !(await portInUse(config.dbPort))) {
    server = await startEmbeddedDb();
  }
  try {
    await task();
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (server) await server.stop();
  }
};
