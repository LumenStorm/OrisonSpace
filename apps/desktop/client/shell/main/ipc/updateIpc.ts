import { app, ipcMain, shell, type BrowserWindow } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import electronUpdater from 'electron-updater';
import type { UpdateCheckResult, UpdateEvent } from '@orison/shared-contracts';
import { getLogger } from '../logger';

// electron-updater is CommonJS; destructure after a default import so the CJS
// build emitted by electron-vite resolves `autoUpdater` correctly.
const { autoUpdater } = electronUpdater;

const RELEASES_PAGE = 'https://github.com/LumenStorm/OrisonSpace/releases/latest';
const LATEST_RELEASE_API = 'https://api.github.com/repos/LumenStorm/OrisonSpace/releases/latest';

/** Returns positive if a > b, negative if a < b, 0 if equal. Tolerates leading "v". */
export function compareSemver(a: string, b: string): number {
  const norm = (v: string) => v.trim().replace(/^v/i, '').split('-')[0].split('.');
  const pa = norm(a);
  const pb = norm(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const ai = Number.parseInt(pa[i] ?? '0', 10) || 0;
    const bi = Number.parseInt(pb[i] ?? '0', 10) || 0;
    if (ai !== bi) return ai - bi;
  }
  return 0;
}

/** True when the major version increased from `current` to `latest`. */
export function isMajorBump(current: string, latest: string): boolean {
  const major = (v: string) => Number.parseInt(v.trim().replace(/^v/i, '').split('.')[0] ?? '0', 10) || 0;
  return major(latest) > major(current);
}

/**
 * Whether electron-updater can self-update this install.
 *
 * The NSIS installer ships `app-update.yml` next to the resources; the portable
 * (`target: dir`) build does NOT, so `autoUpdater.checkForUpdates()` throws and
 * download/install silently no-op. We gate on the file's presence and fall back
 * to a manual GitHub-release download for portable builds.
 */
export function canSelfUpdate(): boolean {
  if (!app.isPackaged) return false;
  try {
    return existsSync(path.join(process.resourcesPath, 'app-update.yml'));
  } catch {
    return false;
  }
}

/**
 * Portable fallback: query the GitHub releases API directly (no app-update.yml
 * needed) so portable users still get notified of new versions, with a manual
 * download link instead of an in-app install.
 */
async function checkViaGitHubApi(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion();
  try {
    const res = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'OrisonSpace' },
    });
    if (!res.ok) {
      return { status: 'error', message: `GitHub API ${res.status}` };
    }
    const data = (await res.json()) as { tag_name?: string; name?: string; body?: string };
    const latestVersion = (data.tag_name ?? data.name ?? '').trim().replace(/^v/i, '');
    if (!latestVersion) {
      return { status: 'up-to-date', currentVersion, latestVersion: currentVersion };
    }
    if (compareSemver(latestVersion, currentVersion) <= 0) {
      return { status: 'up-to-date', currentVersion, latestVersion };
    }
    return {
      status: 'available',
      currentVersion,
      latestVersion,
      isMajor: isMajorBump(currentVersion, latestVersion),
      releaseNotes: typeof data.body === 'string' ? data.body : undefined,
      downloadUrl: RELEASES_PAGE,
      manual: true,
    };
  } catch (err) {
    getLogger().warn({ err }, 'portable update check (GitHub API) threw');
    return { status: 'error', message: err instanceof Error ? err.message : 'Network error' };
  }
}

let configured = false;
let win: BrowserWindow | null = null;

function send(event: UpdateEvent): void {
  win?.webContents.send('update:event', event);
}

function configureAutoUpdater(): void {
  if (configured) return;
  configured = true;

  const logger = getLogger();
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => send({ type: 'checking' }));

  autoUpdater.on('update-available', (info) => {
    const current = app.getVersion();
    send({
      type: 'available',
      currentVersion: current,
      latestVersion: info.version,
      isMajor: isMajorBump(current, info.version),
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    });
  });

  autoUpdater.on('update-not-available', () => {
    send({ type: 'not-available', currentVersion: app.getVersion() });
  });

  autoUpdater.on('download-progress', (progress) => {
    send({ type: 'download-progress', percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    send({ type: 'downloaded', latestVersion: info.version });
  });

  autoUpdater.on('error', (err) => {
    logger.warn({ err }, 'auto-updater error');
    send({ type: 'error', message: err instanceof Error ? err.message : 'Update error' });
  });
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion();

  // electron-updater throws when unpackaged — surface a dev status instead.
  if (!app.isPackaged) {
    return { status: 'dev', currentVersion };
  }

  // Portable / dir build: no app-update.yml, so electron-updater can't run.
  // Check GitHub directly and offer a manual download.
  if (!canSelfUpdate()) {
    return checkViaGitHubApi();
  }

  configureAutoUpdater();

  try {
    const result = await autoUpdater.checkForUpdates();
    const latestVersion = result?.updateInfo?.version;
    if (!latestVersion) {
      return { status: 'up-to-date', currentVersion, latestVersion: currentVersion };
    }
    if (compareSemver(latestVersion, currentVersion) <= 0) {
      return { status: 'up-to-date', currentVersion, latestVersion };
    }
    const notes = result?.updateInfo?.releaseNotes;
    return {
      status: 'available',
      currentVersion,
      latestVersion,
      isMajor: isMajorBump(currentVersion, latestVersion),
      releaseNotes: typeof notes === 'string' ? notes : undefined,
      downloadUrl: RELEASES_PAGE,
    };
  } catch (err) {
    getLogger().warn({ err }, 'update check threw');
    return { status: 'error', message: err instanceof Error ? err.message : 'Network error' };
  }
}

/** Silently check on startup; only the renderer surfaces a prompt if a version is found. */
export async function checkForUpdateOnStartup(): Promise<void> {
  if (!app.isPackaged) return;
  // NSIS builds drive the renderer via autoUpdater's own events. Portable builds
  // have no event stream, so push an `available` event from the API result.
  if (!canSelfUpdate()) {
    const result = await checkViaGitHubApi().catch(() => null);
    if (result?.status === 'available') {
      send({
        type: 'available',
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        isMajor: result.isMajor,
        releaseNotes: result.releaseNotes,
        manual: true,
        downloadUrl: result.downloadUrl,
      });
    }
    return;
  }
  await checkForUpdate().catch(() => {});
}

export function registerUpdateIpc(mainWindow: BrowserWindow): void {
  win = mainWindow;

  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('update:check', () => checkForUpdate());

  ipcMain.handle('update:download', async () => {
    // Only NSIS installs can self-download. Portable builds open the releases
    // page instead (the renderer also handles `manual`, this is a safety net).
    if (!canSelfUpdate()) {
      void shell.openExternal(RELEASES_PAGE);
      return;
    }
    configureAutoUpdater();
    await autoUpdater.downloadUpdate();
  });

  ipcMain.handle('update:install', () => {
    if (!canSelfUpdate()) {
      // Dev / portable fallback: open the releases page for a manual swap.
      void shell.openExternal(RELEASES_PAGE);
      return;
    }
    autoUpdater.quitAndInstall();
  });
}
