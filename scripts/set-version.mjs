// Sync the app version across root + shell package.json from a single argument.
//
// Usage: node scripts/set-version.mjs 0.3.0
//
// Single source of truth is the git tag (CI strips the leading "v" and passes
// the bare semver here). Internal workspace packages stay at 0.0.0 — only the
// root and the desktop shell (whose package.json feeds app.getVersion() and
// electron-builder's ${version} / latest.yml) carry the real version.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const raw = process.argv[2];
if (!raw) {
  console.error('Usage: node scripts/set-version.mjs <version>  (e.g. 0.3.0)');
  process.exit(1);
}

const version = raw.replace(/^v/i, '').trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid semver: "${raw}". Expected e.g. 0.3.0 or 1.2.0-beta.1`);
  process.exit(1);
}

const targets = [
  path.join(repoRoot, 'package.json'),
  path.join(repoRoot, 'apps/desktop/client/shell/package.json'),
];

for (const file of targets) {
  const text = readFileSync(file, 'utf-8');
  const pkg = JSON.parse(text);
  const prev = pkg.version;
  pkg.version = version;
  // Preserve 2-space indentation + trailing newline (matches repo style).
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  console.log(`${path.relative(repoRoot, file)}: ${prev} -> ${version}`);
}

console.log(`\nVersion set to ${version}.`);
