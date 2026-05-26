import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { allowPath } from '../main/ipc/pathGuard';
import { resolveOrisonFilePath } from '../main/orisonFileProtocol';

describe('orison-file protocol guard', () => {
  it('resolves files only when the target is inside an allowed root', () => {
    const projectDir = allowPath(path.resolve('C:/projects/allowed-story'));
    const filePath = path.join(projectDir, 'assets', 'images', 'cover.png');

    expect(resolveOrisonFilePath(`orison-file:///${filePath.replace(/\\/g, '/')}`)).toBe(filePath);
  });

  it('rejects absolute paths outside allowed roots', () => {
    expect(() => resolveOrisonFilePath('orison-file:///C:/Users/example/secret.txt'))
      .toThrow(/outside allowed scope/i);
  });
});
