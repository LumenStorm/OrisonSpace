import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..', '..');

function repoPath(p: string) {
  return resolve(root, p);
}

describe('repository shape', () => {
  it('uses apps and packages instead of the old layout', () => {
    expect(existsSync(repoPath('apps/desktop/client/shell'))).toBe(true);
    expect(existsSync(repoPath('apps/desktop/client/ui'))).toBe(true);
    expect(existsSync(repoPath('apps/desktop/local-bff'))).toBe(true);
    expect(existsSync(repoPath('packages/shared-contracts'))).toBe(true);
    expect(existsSync(repoPath('packages/model-protocols'))).toBe(true);
    expect(existsSync(repoPath('packages/story-sync'))).toBe(true);
  });
});
