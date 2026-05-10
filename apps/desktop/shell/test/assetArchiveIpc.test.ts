import path from 'node:path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyProjectDocument,
  loadProject,
  saveProject,
} from '../../local-bff/sync/localProjectRepository';

const { handle } = vi.hoisted(() => ({
  handle: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: { handle },
}));

import { registerAssetArchiveIpc } from '../main/ipc/assetArchiveIpc';
import { allowPath } from '../main/ipc/pathGuard';

const TEST_PROJECT_PATH = path.join(process.cwd(), '.tmp', 'asset-archive-delete-project');

describe('asset archive IPC', () => {
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

  it('registers an archive delete handler that delegates to the local BFF', async () => {
    const project = createEmptyProjectDocument('Archive Delete IPC Test');
    const withArchiveCards = {
      ...project,
      asset_cards: [
        {
          id: 'char_lin_qi',
          type: 'character' as const,
          name: 'Lin Qi',
          summary: 'Calm detective',
          tags: ['lead'],
          relationships: [],
          sourceRefs: ['assets/characters/lin-qi.yaml'],
          status: 'active' as const,
          archive: {
            path: 'assets/characters/lin-qi.yaml',
            slug: 'lin-qi',
            schemaVersion: 1,
          },
          visuals: {
            primaryImage: 'assets/images/lin-qi-main.png',
            gallery: [
              { id: 'img_main', path: 'assets/images/lin-qi-main.png', kind: 'primary' as const },
            ],
          },
        },
      ],
    };

    saveProject(TEST_PROJECT_PATH, withArchiveCards as any);
    mkdirSync(path.join(TEST_PROJECT_PATH, 'assets', 'images'), { recursive: true });
    writeFileSync(path.join(TEST_PROJECT_PATH, 'assets', 'images', 'lin-qi-main.png'), 'main');

    registerAssetArchiveIpc();

    expect(handle).toHaveBeenCalledWith('assetArchive:delete', expect.any(Function));

    const [, handler] = handle.mock.calls[0]!;
    await expect(handler({}, TEST_PROJECT_PATH, 'char_lin_qi')).resolves.toBeUndefined();

    const loaded = loadProject(TEST_PROJECT_PATH)!;
    expect(loaded.asset_cards ?? []).toEqual([]);
    expect(existsSync(path.join(TEST_PROJECT_PATH, 'assets', 'characters', 'lin-qi.yaml'))).toBe(false);
    expect(existsSync(path.join(TEST_PROJECT_PATH, 'assets', 'images', 'lin-qi-main.png'))).toBe(false);
  });
});
