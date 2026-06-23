import path from 'node:path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// fileHandlers → toolNotify → `import { BrowserWindow } from 'electron'`, which
// throws at load time in CI where the electron binary isn't installed. Mock it
// so this pure-fs search test doesn't drag in the desktop runtime.
vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
}));

import { searchProjectFiles } from '../main/ipc/toolHandlers/fileHandlers';

const TEST_DIR = path.join(process.cwd(), 'test-tmp-search');

function write(rel: string, content: string) {
  const fp = path.join(TEST_DIR, rel);
  mkdirSync(path.dirname(fp), { recursive: true });
  writeFileSync(fp, content, 'utf-8');
}

describe('searchProjectFiles', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('returns structured {path,line,text} hits with project-relative paths', () => {
    write('chapters/one.md', 'hello world\nsecond line\nhello again');
    write('chapters/two.md', 'nothing here');

    const hits = searchProjectFiles(TEST_DIR, 'hello');

    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ line: 1, text: 'hello world' });
    expect(hits[1]).toMatchObject({ line: 3, text: 'hello again' });
    // path is relative to projectDir, not absolute
    expect(hits[0].path).not.toContain(TEST_DIR);
    expect(hits[0].path.replace(/\\/g, '/')).toBe('chapters/one.md');
  });

  it('is case-insensitive and trims matched lines', () => {
    write('a.txt', '   MixedCase Match   ');
    const hits = searchProjectFiles(TEST_DIR, 'mixedcase');
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toBe('MixedCase Match');
  });

  it('honors maxResults', () => {
    write('big.txt', Array.from({ length: 50 }, () => 'needle').join('\n'));
    const hits = searchProjectFiles(TEST_DIR, 'needle', 10);
    expect(hits).toHaveLength(10);
  });

  it('skips dotfiles and node_modules', () => {
    write('.hidden/secret.txt', 'needle');
    write('node_modules/pkg/index.js', 'needle');
    write('visible.txt', 'needle');
    const hits = searchProjectFiles(TEST_DIR, 'needle');
    expect(hits).toHaveLength(1);
    expect(hits[0].path.replace(/\\/g, '/')).toBe('visible.txt');
  });

  it('rejects empty query', () => {
    expect(() => searchProjectFiles(TEST_DIR, '')).toThrow(/non-empty/);
  });

  it('rejects an invalid regex with a clean error', () => {
    expect(() => searchProjectFiles(TEST_DIR, '(')).toThrow(/invalid regular expression/);
  });
});
