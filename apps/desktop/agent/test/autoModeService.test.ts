import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createAutoModeService } from '../src/engine/autoMode/autoModeService';
import { saveAutoModeState } from '../src/engine/autoMode/autoModeStore';
import type { NovelAutoModeState } from '@orison/shared-contracts';

const TEST_DIR = path.join(process.cwd(), 'test-tmp-auto-mode-service');

function makeState(autoModeId: string, overrides: Partial<NovelAutoModeState> = {}): NovelAutoModeState {
  const now = new Date('2026-05-05T01:00:00.000Z').toISOString();
  return {
    autoModeId,
    projectPath: TEST_DIR,
    status: 'paused',
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
    schemaVersion: 1,
    ...overrides,
  };
}

describe('autoModeService persistence', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('restoreFromProject re-registers persisted sessions and exposes them via getState', () => {
    const persisted = makeState('auto_persist');
    saveAutoModeState(persisted);

    const service = createAutoModeService();
    const restored = service.restoreFromProject(TEST_DIR);
    expect(restored.map((s) => s.autoModeId)).toEqual(['auto_persist']);

    const live = service.getState('auto_persist');
    expect(live?.status).toBe('paused');
    expect(live?.mode).toBe('generate');
  });

  it('getState returns null when no in-memory or persisted record exists', () => {
    const service = createAutoModeService();
    expect(service.getState('auto_unknown')).toBeNull();
  });

  it('restoreFromProject is idempotent for already-tracked sessions', () => {
    saveAutoModeState(makeState('auto_dup'));
    const service = createAutoModeService();
    const first = service.restoreFromProject(TEST_DIR);
    const second = service.restoreFromProject(TEST_DIR);
    expect(first.length).toBe(1);
    expect(second.length).toBe(1);
    expect(service.getState('auto_dup')?.autoModeId).toBe('auto_dup');
  });
});
