import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), send: vi.fn() }
}));

import { exposedDesktopApi } from '../preload/index';

describe('preload security surface', () => {
  it('only exposes the whitelisted desktop api', () => {
    expect(Object.keys(exposedDesktopApi).sort()).toEqual([
      'checkForUpdate',
      'close',
      'copyCoverImage',
      'createEntry',
      'createProjectDirectory',
      'deleteAsset',
      'deleteEntry',
      'deleteProjectFile',
      'deleteTask',
      'ensureProjectRegistration',
      'generateImage',
      'generateText',
      'generateVideo',
      'getAppVersion',
      'getLocale',
      'gitCommitDiff',
      'gitFileAtCommit',
      'gitIsRepo',
      'gitLog',
      'isMaximized',
      'listAssets',
      'listRemoteModels',
      'listTasks',
      'loadModelConfig',
      'loadProjectDocument',
      'loadProjectMeta',
      'loadUserPreferences',
      'maximize',
      'minimize',
      'moveProjectFile',
      'onToolEvent',
      'openLogsDir',
      'openPath',
      'pathExists',
      'pickCoverImage',
      'pickProjectDirectory',
      'platform',
      'readDirectory',
      'readFile',
      'readFileBinary',
      'renameEntry',
      'runStorySync',
      'saveBase64Image',
      'saveModelConfig',
      'saveProjectMeta',
      'saveUserPreferences',
      'showItemInFolder',
      'syncField',
      'updateAsset',
      'updateTaskStatus',
      'upsertAsset',
      'upsertTask',
      'writeFile',
      'writeLog',
    ]);
  });

  it('does not expose any apiKey-bearing function on the renderer surface', () => {
    // The whitelisted IPC handlers move slot pairs (profileId, modelId) across
    // IPC; apiKey lives in desktop main's safeStorage and is decrypted only
    // there. Renderer never sees it.
    const apiKeys = Object.keys(exposedDesktopApi).filter((key) => /apiKey/i.test(key));
    expect(apiKeys).toEqual([]);
  });
});
