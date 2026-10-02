// Shared configuration for the local stack (DB, PostgREST, auth server).
// Reads .env.local then .env (same precedence as Vite). Secrets that don't need to be
// chosen by a human are generated once and kept outside the repo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

dotenv.config({ path: path.join(ROOT, '.env.local'), quiet: true });
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

// Default data location is deliberately OUTSIDE the project folder: the project lives in
// OneDrive, and database files must not be synced to the cloud.
const defaultDataHome = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'),
  'training-needs-app'
);

export const DATA_HOME = process.env.LOCAL_DATA_DIR || defaultDataHome;
export const PG_DATA_DIR = path.join(DATA_HOME, 'pgdata');
const SECRETS_FILE = path.join(DATA_HOME, 'secrets.json');

const loadSecrets = () => {
  fs.mkdirSync(DATA_HOME, { recursive: true });
  let secrets = {};
  if (fs.existsSync(SECRETS_FILE)) secrets = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
  let changed = false;
  for (const key of ['jwtSecret', 'superuserPassword', 'authenticatorPassword']) {
    if (!secrets[key]) {
      secrets[key] = crypto.randomBytes(32).toString('base64url');
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  return secrets;
};

const secrets = loadSecrets();

export const config = {
  // Set DATABASE_URL to use an existing PostgreSQL server (e.g. a company server) instead of
  // the embedded one. It must connect as a role that can create roles/schemas for migrations.
  externalDatabaseUrl: process.env.DATABASE_URL || null,
  dbName: process.env.LOCAL_DB_NAME || 'training_needs',
  dbPort: Number(process.env.LOCAL_DB_PORT || 54329),
  superuserPassword: process.env.LOCAL_DB_PASSWORD || secrets.superuserPassword,
  authenticatorPassword: process.env.AUTHENTICATOR_PASSWORD || secrets.authenticatorPassword,
  jwtSecret: process.env.LOCAL_JWT_SECRET || secrets.jwtSecret,
  jwtExpirySeconds: Number(process.env.LOCAL_JWT_EXPIRY || 3600),
  postgrestPort: Number(process.env.POSTGREST_PORT || 3000),
  authPort: Number(process.env.AUTH_PORT || 4000),
  allowedOrigins: (process.env.AUTH_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(','),
  // Admin endpoints in Supabase mode (server-side only, never VITE_ prefixed)
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || null,
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || null,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || null
};

export const databaseUrl = () =>
  config.externalDatabaseUrl ||
  `postgresql://postgres:${encodeURIComponent(config.superuserPassword)}@127.0.0.1:${config.dbPort}/${config.dbName}`;

export const authenticatorUrl = () => {
  const url = new URL(databaseUrl());
  url.username = 'authenticator';
  url.password = config.authenticatorPassword;
  return url.toString();
};
