import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startAutoMode } from '../src/shared/api/novelChapter';

describe('novel chapter API auth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('sends the persisted bearer token when starting auto mode', async () => {
    localStorage.setItem('orison_token', 'token-auto-mode');
    const captured: RequestInit[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      captured.push(init ?? {});
      return new Response(
        JSON.stringify({
          autoModeId: 'auto_1',
          projectPath: 'C:/novels/project',
          status: 'planning',
          pendingChapterIds: [],
          completedChapterIds: [],
          currentChapterId: null,
          currentRunId: null,
          totalChapters: 0,
          lastError: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    await startAutoMode('C:/novels/project', undefined, 'Approved premise');

    expect(captured[0]?.headers).toMatchObject({
      Authorization: 'Bearer token-auto-mode',
      'Content-Type': 'application/json',
    });
  });
});
