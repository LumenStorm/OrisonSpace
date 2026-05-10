import path from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { handle } = vi.hoisted(() => ({
  handle: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: { handle },
}));

import { registerGuidedNovelIpc } from '../main/ipc/guidedNovelIpc';
import { allowPath } from '../main/ipc/pathGuard';

const TEST_PROJECT_PATH = path.join(process.cwd(), '.tmp', 'guided-novel-ipc-project');

describe('guided novel IPC', () => {
  beforeEach(() => {
    handle.mockReset();
    allowPath(TEST_PROJECT_PATH);
    if (existsSync(TEST_PROJECT_PATH)) {
      rmSync(TEST_PROJECT_PATH, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_PROJECT_PATH)) {
      rmSync(TEST_PROJECT_PATH, { recursive: true, force: true });
    }
  });

  it('registers load and save handlers for guided workflow state', async () => {
    registerGuidedNovelIpc();

    expect(handle).toHaveBeenCalledWith('guidedNovel:load', expect.any(Function));
    expect(handle).toHaveBeenCalledWith('guidedNovel:save', expect.any(Function));

    const [, loadHandler] = handle.mock.calls.find((call) => call[0] === 'guidedNovel:load')!;
    const [, saveHandler] = handle.mock.calls.find((call) => call[0] === 'guidedNovel:save')!;

    await expect(
      saveHandler({}, TEST_PROJECT_PATH, {
        session: {
          sessionId: 'session_ipc',
          projectPath: TEST_PROJECT_PATH,
          status: 'planning',
          baselineVersion: 1,
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z',
        },
        planningBaseline: {
          version: 1,
          fields: {
            creative_brief: {
              rawRequirement: 'A haunted station waits for the last train.',
            },
          },
        },
      }),
    ).resolves.toBeUndefined();

    const loaded = await loadHandler({}, TEST_PROJECT_PATH);
    expect(loaded?.session?.status).toBe('planning');
    expect(loaded?.planningBaseline?.version).toBe(1);
  });
});
