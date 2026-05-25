import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  AUTO_MODE_DIR,
  AUTO_MODE_SCHEMA_VERSION,
  listProjectAutoModeStates,
  loadAutoModeState,
  saveAutoModeState,
} from '../src/engine/autoMode/autoModeStore';
import type { NovelAutoModeState } from '@orison/shared-contracts';

const TEST_DIR = path.join(process.cwd(), 'test-tmp-auto-mode-store');

function makeState(autoModeId: string, overrides: Partial<NovelAutoModeState> = {}): NovelAutoModeState {
  const now = new Date('2026-05-05T01:00:00.000Z').toISOString();
  return {
    autoModeId,
    projectPath: TEST_DIR,
    status: 'running',
    pendingChapterIds: ['ch_a'],
    completedChapterIds: [],
    currentChapterId: null,
    currentRunId: null,
    totalChapters: 1,
    startedAt: now,
    updatedAt: now,
    finishedAt: undefined,
    lastError: null,
    mode: 'generate',
    reviewMode: 'pass',
    ...overrides,
  };
}

describe('autoModeStore', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('saves a session yaml under runs/auto-mode and stamps schemaVersion', () => {
    const state = makeState('auto_one');
    saveAutoModeState(state);
    const filePath = path.join(TEST_DIR, AUTO_MODE_DIR, 'auto_one.yaml');
    expect(existsSync(filePath)).toBe(true);
    const written = YAML.parse(readFileSync(filePath, 'utf8')) as NovelAutoModeState;
    expect(written.autoModeId).toBe('auto_one');
    expect(written.schemaVersion).toBe(AUTO_MODE_SCHEMA_VERSION);
    expect(written.mode).toBe('generate');
    expect(written.reviewMode).toBe('pass');
  });

  it('loads a saved session by id', () => {
    const state = makeState('auto_two', { status: 'paused', completedChapterIds: ['ch_b'] });
    saveAutoModeState(state);
    const loaded = loadAutoModeState(TEST_DIR, 'auto_two');
    expect(loaded?.status).toBe('paused');
    expect(loaded?.completedChapterIds).toEqual(['ch_b']);
  });

  it('returns null when the session file does not exist', () => {
    expect(loadAutoModeState(TEST_DIR, 'missing')).toBeNull();
  });

  it('lists project auto-mode states and skips broken yaml files', () => {
    saveAutoModeState(makeState('auto_a'));
    saveAutoModeState(makeState('auto_b', { status: 'completed', finishedAt: new Date('2026-05-05T02:00:00.000Z').toISOString() }));
    writeFileSync(path.join(TEST_DIR, AUTO_MODE_DIR, 'broken.yaml'), 'not: : valid: yaml :::', 'utf8');
    const states = listProjectAutoModeStates(TEST_DIR);
    const ids = states.map((s) => s.autoModeId).sort();
    expect(ids).toEqual(['auto_a', 'auto_b']);
  });

  it('returns an empty list when the directory is missing', () => {
    expect(listProjectAutoModeStates(path.join(TEST_DIR, '不存在'))).toEqual([]);
  });
});
