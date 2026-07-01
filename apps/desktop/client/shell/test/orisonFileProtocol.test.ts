import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// orisonFileProtocol imports `net` from electron at module load; on CI the
// electron binary isn't installed, so importing it would throw getElectronPath.
// resolveOrisonFilePath is pure and never touches net — mock electron away.
vi.mock('electron', () => ({ net: { fetch: vi.fn() } }));

import { allowPath } from '../main/ipc/pathGuard';
import { resolveOrisonFilePath } from '../main/orisonFileProtocol';

const ALLOWED_ROOT = path.resolve('/tmp/test-projects/allowed-story');
const OUTSIDE_PATH = path.resolve('/tmp/other/secret.txt');

describe('orison-file protocol guard', () => {
  it('resolves files only when the target is inside an allowed root', () => {
    const projectDir = allowPath(ALLOWED_ROOT);
    const filePath = path.join(projectDir, 'assets', 'images', 'cover.png');

    expect(resolveOrisonFilePath(`orison-file:///${filePath.replace(/\\/g, '/')}`)).toBe(filePath);
  });

  it('rejects absolute paths outside allowed roots', () => {
    const uri = `orison-file:///${OUTSIDE_PATH.replace(/\\/g, '/')}`;
    expect(() => resolveOrisonFilePath(uri))
      .toThrow(/outside allowed scope/i);
  });
});
