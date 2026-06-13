import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getVersion: () => '1.2.3', isPackaged: false },
  ipcMain: { handle: vi.fn() },
  shell: { openExternal: vi.fn() },
}));

vi.mock('electron-updater', () => ({
  default: { autoUpdater: { on: vi.fn() } },
}));

vi.mock('../main/logger', () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

import { canSelfUpdate, compareSemver, isMajorBump } from '../main/ipc/updateIpc';

describe('canSelfUpdate', () => {
  it('is false when the app is not packaged (dev / portable)', () => {
    // The electron mock reports isPackaged: false, so self-update is disabled
    // and the portable GitHub-API fallback path is taken instead.
    expect(canSelfUpdate()).toBe(false);
  });
});

describe('compareSemver', () => {
  it('orders versions numerically, not lexically', () => {
    expect(compareSemver('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('0.2.0', '0.3.0')).toBeLessThan(0);
  });

  it('tolerates a leading v and pre-release suffix', () => {
    expect(compareSemver('v2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareSemver('1.2.0-beta.1', '1.2.0')).toBe(0);
  });

  it('treats missing segments as zero', () => {
    expect(compareSemver('1', '1.0.0')).toBe(0);
    expect(compareSemver('1.1', '1.0.5')).toBeGreaterThan(0);
  });
});

describe('isMajorBump', () => {
  it('is true only when the major version increases', () => {
    expect(isMajorBump('1.4.0', '2.0.0')).toBe(true);
    expect(isMajorBump('0.9.0', '1.0.0')).toBe(true);
  });

  it('is false for minor/patch bumps and same major', () => {
    expect(isMajorBump('1.0.0', '1.5.0')).toBe(false);
    expect(isMajorBump('2.0.0', '2.0.1')).toBe(false);
  });

  it('is false when major does not increase', () => {
    expect(isMajorBump('2.0.0', '1.9.0')).toBe(false);
  });

  it('tolerates a leading v', () => {
    expect(isMajorBump('v1.0.0', 'v2.0.0')).toBe(true);
  });
});
