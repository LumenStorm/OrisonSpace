// Prepares an embeddable Python runtime under resources/python-runtime/ for the
// portable build. PACKAGING-ONLY: never invoked by dev/build — only by pack:portable.
// Idempotent; on failure it warns and exits 0 so the app can fall back to PATH python.
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PY_VERSION = '3.12.8';
const PY_ABI = PY_VERSION.split('.').slice(0, 2).join('.'); // '3.12' — target wheel ABI
const ZIP = `python-${PY_VERSION}-embed-amd64.zip`;
const URL = `https://www.python.org/ftp/python/${PY_VERSION}/${ZIP}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shellDir = path.resolve(__dirname, '..');
const runtimeDir = path.join(shellDir, 'resources', 'python-runtime');
const cacheDir = path.join(shellDir, '.python-cache');
const reqFile = path.resolve(shellDir, '../../agent/python/requirements.runtime.txt');

function warn(msg) {
  console.warn(`[prepare-python-runtime] WARN: ${msg}`);
}

function isReady() {
  const exe = path.join(runtimeDir, 'python.exe');
  const sitePkgs = path.join(runtimeDir, 'Lib', 'site-packages', 'yaml');
  return existsSync(exe) && existsSync(sitePkgs);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        download(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

function unzip(zipPath, destDir) {
  // PowerShell is available on Windows packaging machines; avoids a zip dependency.
  execFileSync('powershell', [
    '-NoProfile', '-Command',
    `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force`,
  ], { stdio: 'inherit' });
}

function enableSitePackages() {
  // Embeddable distros ship a python3xx._pth with `#import site` commented out.
  // Uncomment it so pip --target installs under Lib/site-packages resolve.
  const pthName = `python${PY_VERSION.split('.').slice(0, 2).join('')}._pth`;
  const pthPath = path.join(runtimeDir, pthName);
  if (!existsSync(pthPath)) {
    warn(`${pthName} not found; site-packages may not resolve`);
    return;
  }
  let content = readFileSync(pthPath, 'utf8');
  if (!content.includes('\nimport site')) {
    content = content.replace(/#\s*import site/g, 'import site');
    if (!content.includes('import site')) content += '\nimport site\n';
    content += '\nLib\\site-packages\n';
    writeFileSync(pthPath, content, 'utf8');
  }
}

function installDeps() {
  const target = path.join(runtimeDir, 'Lib', 'site-packages');
  mkdirSync(target, { recursive: true });
  // The host pip may be a different Python version than the embeddable target.
  // Force binary wheels for the target ABI so native extensions (pydantic_core,
  // jiter, yaml) match the embedded interpreter, not the host.
  execFileSync('python', [
    '-m', 'pip', 'install', '--no-warn-script-location',
    '--target', target,
    '--python-version', PY_ABI,
    '--implementation', 'cp',
    '--only-binary=:all:',
    '-r', reqFile,
  ], { stdio: 'inherit' });
}

async function main() {
  if (isReady()) {
    console.log('[prepare-python-runtime] runtime already prepared, skipping');
    return;
  }
  mkdirSync(cacheDir, { recursive: true });
  const zipPath = path.join(cacheDir, ZIP);
  if (!existsSync(zipPath)) {
    console.log(`[prepare-python-runtime] downloading ${URL}`);
    await download(URL, zipPath);
  }
  rmSync(runtimeDir, { recursive: true, force: true });
  mkdirSync(runtimeDir, { recursive: true });
  unzip(zipPath, runtimeDir);
  enableSitePackages();
  installDeps();
  console.log(`[prepare-python-runtime] ready at ${runtimeDir}`);
}

main().catch((err) => {
  warn(`${err.message} — portable build will fall back to PATH python`);
  process.exit(0);
});
