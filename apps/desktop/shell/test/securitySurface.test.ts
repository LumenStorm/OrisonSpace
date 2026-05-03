import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), send: vi.fn() }
}));

import { exposedDesktopApi } from '../preload/index';

describe('preload security surface', () => {
  it('only exposes the whitelisted desktop api', () => {
    expect(Object.keys(exposedDesktopApi).sort()).toEqual([
      'close',
      'copyCoverImage',
      'createEntry',
      'createProjectDirectory',
      'deleteEntry',
      'getLocale',
      'isMaximized',
      'loadModelConfig',
      'loadProjectMeta',
      'loadUserPreferences',
      'maximize',
      'minimize',
      'openPath',
      'pickCoverImage',
      'pickProjectDirectory',
      'platform',
      'readDirectory',
      'readFile',
      'renameEntry',
      'saveModelConfig',
      'saveProjectMeta',
      'saveUserPreferences',
      'showItemInFolder',
      'syncField',
      'writeFile',
    ]);
  });
});
