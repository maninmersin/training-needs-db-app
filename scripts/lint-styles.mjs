// npm run lint:styles: fails on hard-coded colours and new inline styles (rules in src/lib/styleRules.js)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { checkFile } from '../src/lib/styleRules.js';

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(jsx|js|css)$/.test(name)) files.push(full);
  }
};
walk('src');

const problems = files.flatMap((file) => {
  const path = file.split(sep).join('/');
  return checkFile(path, readFileSync(file, 'utf8'));
});

if (problems.length === 0) {
  console.log(`lint:styles: ${files.length} files checked, no problems`);
} else {
  problems.forEach((p) => console.error(`${p.path}:${p.line}  ${p.message}`));
  console.error(`\nlint:styles: ${problems.length} problem(s)`);
  process.exit(1);
}
