import path from 'node:path';
import os from 'node:os';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserPreferencesConfig } from '@orison/shared-contracts';

const { handle, safeStorage } = vi.hoisted(() => ({
  handle: vi.fn(),
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  ipcMain: { handle },
  safeStorage,
}));

const TEST_HOME = path.join(process.cwd(), 'test-tmp-user-prefs');

// User-preferences path derives from os.homedir(); point it at a temp dir.
vi.spyOn(os, 'homedir').mockReturnValue(TEST_HOME);

import { registerConfigIpc } from '../main/ipc/configIpc';

function getHandlers() {
  handle.mockReset();
  registerConfigIpc();
  const save = handle.mock.calls.find(([c]) => c === 'config:save-user-preferences')![1];
  const load = handle.mock.calls.find(([c]) => c === 'config:load-user-preferences')![1];
  return { save, load };
}

describe('user preferences IPC round-trip', () => {
  beforeEach(() => {
    if (existsSync(TEST_HOME)) rmSync(TEST_HOME, { recursive: true, force: true });
    mkdirSync(TEST_HOME, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_HOME)) rmSync(TEST_HOME, { recursive: true, force: true });
  });

  it('persists all fields, including previously-dropped writing/appearance settings', async () => {
    const { save, load } = getHandlers();
    const written: UserPreferencesConfig = {
      theme: 'dark',
      locale: 'zh-CN',
      autoApplyPatches: false,
      autoCheckUpdates: false,
      readingFontWeight: 500,
      readingFontScale: 1.15,
      paragraphIndent: false,
      showWordCount: false,
      autoSaveEnabled: false,
      autoSaveInterval: 5000,
      spellCheck: true,
      wordCountGoal: 8000,
      editorLineHeight: 2.0,
    };

    await save({}, written);
    const read = (await load({})) as UserPreferencesConfig;

    // The fields the old writeUserPreferences silently dropped are the regression focus.
    expect(read.paragraphIndent).toBe(false);
    expect(read.showWordCount).toBe(false);
    expect(read.editorLineHeight).toBe(2.0);
    // New creative settings round-trip too.
    expect(read.autoSaveEnabled).toBe(false);
    expect(read.autoSaveInterval).toBe(5000);
    expect(read.spellCheck).toBe(true);
    expect(read.wordCountGoal).toBe(8000);
    // Existing fields unchanged.
    expect(read.theme).toBe('dark');
    expect(read.locale).toBe('zh-CN');
    expect(read.autoApplyPatches).toBe(false);
    expect(read.readingFontWeight).toBe(500);
    expect(read.readingFontScale).toBe(1.15);
  });

  it('falls back to defaults when the file is absent', async () => {
    const { load } = getHandlers();
    const read = (await load({})) as UserPreferencesConfig;
    expect(read.theme).toBe('system');
    expect(read.paragraphIndent).toBe(true);
    expect(read.editorLineHeight).toBe(1.75);
    expect(read.autoSaveInterval).toBe(1500);
  });
});
