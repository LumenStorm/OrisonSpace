import path from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyProjectDocument,
  loadProject,
  saveProject
} from '@orison/desktop-local-bff';

const { handle } = vi.hoisted(() => ({
  handle: vi.fn()
}));

vi.mock('electron', () => ({
  ipcMain: { handle }
}));

import { registerFieldSyncIpc } from '../main/ipc/fieldSyncIpc';
import { allowPath } from '../main/ipc/pathGuard';

const TEST_PROJECT_PATH = path.join(process.cwd(), 'test-tmp-field-sync-project');

describe('field sync IPC', () => {
  beforeEach(() => {
    handle.mockReset();
    if (existsSync(TEST_PROJECT_PATH)) {
      rmSync(TEST_PROJECT_PATH, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_PROJECT_PATH)) {
      rmSync(TEST_PROJECT_PATH, { recursive: true, force: true });
    }
  });

  it('registers a field sync handler that forwards edits to the local BFF', async () => {
    saveProject(TEST_PROJECT_PATH, createEmptyProjectDocument('Field Sync Test'));

    registerFieldSyncIpc();

    expect(handle).toHaveBeenCalledWith('field:sync', expect.any(Function));

    const [, handler] = handle.mock.calls[0]!;
    const payload = { rawRequirement: 'Make the opening darker.' };

    allowPath(TEST_PROJECT_PATH);
    await expect(handler({}, TEST_PROJECT_PATH, 'creative_brief', payload)).resolves.toBeUndefined();

    const project = loadProject(TEST_PROJECT_PATH);
    expect(project?.creative_brief).toMatchObject(payload);
    expect(project?.creative_brief?.taboos).toEqual([]);
    expect(project?.creative_brief?.userConstraints).toEqual([]);
    expect(project?.field_metadata?.creative_brief?.version).toBe(1);
  });
});
