// Starts a private PostgreSQL 17 server from node_modules (no installer, no admin rights).
// Skipped entirely when DATABASE_URL points at an existing server.
import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { config, PG_DATA_DIR } from './config.js';

export const startEmbeddedDb = async () => {
  const server = new EmbeddedPostgres({
    databaseDir: PG_DATA_DIR,
    user: 'postgres',
    password: config.superuserPassword,
    port: config.dbPort,
    persistent: true,
    onLog: () => {},
    onError: (msg) => console.error('[postgres]', String(msg).trim())
  });

  if (!fs.existsSync(path.join(PG_DATA_DIR, 'PG_VERSION'))) {
    console.log(`Creating new local database cluster in ${PG_DATA_DIR}`);
    await server.initialise();
  }
  await server.start();

  const admin = new pg.Client({
    host: '127.0.0.1',
    port: config.dbPort,
    user: 'postgres',
    password: config.superuserPassword,
    database: 'postgres'
  });
  await admin.connect();
  const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [config.dbName]);
  if (rowCount === 0) await admin.query(`create database "${config.dbName}"`);
  await admin.end();

  return server;
};
