// npm run setup:postgrest - downloads PostgREST into tools/ (git-ignored).
// Pinned to the version Supabase was running for this project (supabase/.temp/rest-version).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './config.js';

const VERSION = 'v12.2.3';

if (process.platform !== 'win32') {
  console.log(`Install PostgREST ${VERSION} for your OS (https://github.com/PostgREST/postgrest/releases)`);
  console.log(`and place the binary at tools/postgrest`);
  process.exit(0);
}

const toolsDir = path.join(ROOT, 'tools');
const target = path.join(toolsDir, 'postgrest.exe');
if (fs.existsSync(target)) {
  console.log(`✓ ${path.relative(ROOT, target)} already present`);
  process.exit(0);
}

const url = `https://github.com/PostgREST/postgrest/releases/download/${VERSION}/postgrest-${VERSION}-windows-x64.zip`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'postgrest-'));
const zip = path.join(tmp, 'postgrest.zip');

console.log(`Downloading ${url}`);
const res = await fetch(url);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));

execFileSync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -Force '${zip}' '${tmp}'`]);
const found = fs.readdirSync(tmp, { recursive: true }).find((f) => f.toString().endsWith('postgrest.exe'));
if (!found) throw new Error('postgrest.exe not found in archive');

fs.mkdirSync(toolsDir, { recursive: true });
fs.copyFileSync(path.join(tmp, found.toString()), target);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`✓ installed ${path.relative(ROOT, target)}`);
