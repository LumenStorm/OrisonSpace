import { app, ipcMain, shell, type BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import type { UpdateCheckResult, UpdateEvent } from '@orison/shared-contracts';
import { getLogger } from '../logger';

// electron-updater is CommonJS; destructure after a default import so the CJS
// build emitted by electron-vite resolves `autoUpdater` correctly.
const { autoUpdater } = electronUpdater;

const RELEASES_PAGE = 'https://github.com/LumenStorm/OrisonSpace/releases/latest';

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
  await checkForUpdate().catch(() => {});
}

export function registerUpdateIpc(mainWindow: BrowserWindow): void {
  win = mainWindow;

  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('update:check', () => checkForUpdate());

  ipcMain.handle('update:download', async () => {
    if (!app.isPackaged) return;
    configureAutoUpdater();
    await autoUpdater.downloadUpdate();
  });

  ipcMain.handle('update:install', () => {
    if (!app.isPackaged) {
      // Dev/portable fallback: open the releases page.
      void shell.openExternal(RELEASES_PAGE);
      return;
    }
    autoUpdater.quitAndInstall();
  });
}
