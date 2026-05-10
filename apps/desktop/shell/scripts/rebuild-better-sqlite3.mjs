import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import packageJson from '../package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const shellRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(shellRoot, '..', '..', '..');
const electronVersion = packageJson.devDependencies.electron.replace(/^[^\d]*/, '');
const nodeGypCacheDir = path.join(workspaceRoot, '.cache', 'node-gyp');

mkdirSync(nodeGypCacheDir, { recursive: true });

const envCommand = [
  `$env:npm_config_runtime='electron'`,
  `$env:npm_config_target='${electronVersion}'`,
  `$env:npm_config_arch='${process.arch}'`,
  `$env:npm_config_disturl='https://electronjs.org/headers'`,
  `$env:npm_config_devdir='${nodeGypCacheDir.replace(/\\/g, '\\\\')}'`,
  `$env:npm_config_build_from_source='true'`,
  `pnpm rebuild better-sqlite3`,
].join('; ');

const result = process.platform === 'win32'
  ? spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', envCommand],
    {
      cwd: shellRoot,
      stdio: 'inherit',
      env: process.env,
    },
  )
  : spawnSync('pnpm', ['rebuild', 'better-sqlite3'], {
    cwd: shellRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_runtime: 'electron',
      npm_config_target: electronVersion,
      npm_config_arch: process.arch,
      npm_config_disturl: 'https://electronjs.org/headers',
      npm_config_devdir: nodeGypCacheDir,
      npm_config_build_from_source: 'true',
    },
  });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
