import { app, ipcMain } from 'electron';
import type { UpdateCheckResult, UpdateManifest } from '@orison/shared-contracts';
import { getLogger } from '../logger';
import { readUserPreferencesFromDisk } from './configIpc';

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

function parseManifest(value: unknown): UpdateManifest | null {
  if (!value || typeof value !== 'object') return null;
  const m = value as Record<string, unknown>;
  const latestVersion = typeof m.latestVersion === 'string' ? m.latestVersion : null;
  const downloadUrl = typeof m.downloadUrl === 'string' ? m.downloadUrl : null;
  if (!latestVersion || !downloadUrl) return null;
  const releaseNotes = typeof m.releaseNotes === 'string' ? m.releaseNotes : undefined;
  return { latestVersion, downloadUrl, releaseNotes };
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const logger = getLogger();
  const prefs = readUserPreferencesFromDisk();
  const manifestUrl = prefs.updateManifestUrl;
  const currentVersion = app.getVersion();

  if (!manifestUrl) {
    return { status: 'not-configured' };
  }

  try {
    const response = await fetch(manifestUrl, { cache: 'no-store' });
    if (!response.ok) {
      logger.warn({ manifestUrl, status: response.status }, 'update manifest fetch failed');
      return { status: 'error', message: `HTTP ${response.status}` };
    }
    const manifest = parseManifest(await response.json());
    if (!manifest) {
      logger.warn({ manifestUrl }, 'update manifest invalid shape');
      return { status: 'error', message: 'Invalid manifest' };
    }

    if (compareSemver(manifest.latestVersion, currentVersion) <= 0) {
      return { status: 'up-to-date', currentVersion, latestVersion: manifest.latestVersion };
    }
    return {
      status: 'available',
      currentVersion,
      latestVersion: manifest.latestVersion,
      downloadUrl: manifest.downloadUrl,
      releaseNotes: manifest.releaseNotes,
    };
  } catch (err) {
    logger.warn({ manifestUrl, err }, 'update check threw');
    return { status: 'error', message: err instanceof Error ? err.message : 'Network error' };
  }
}

export function registerUpdateIpc() {
  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('update:check', () => checkForUpdate());
}
