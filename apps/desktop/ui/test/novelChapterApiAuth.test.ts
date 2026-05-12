import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startAutoMode, startChapterRun } from '../src/shared/api/novelChapter';

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

  it('sends selected novel model runtime config with chapter and auto-mode requests', async () => {
    localStorage.setItem('orison_token', 'token-auto-mode');
    const bodies: Record<string, unknown>[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      return new Response(
        JSON.stringify({
          runId: 'run_1',
          status: 'delivered',
          currentNodeId: null,
          projectPath: 'C:/novels/project',
          completedNodes: [],
          pendingNodes: [],
          artifacts: {},
          review: null,
          archive: null,
          delivery: null,
          feedback: null,
          autoModeId: 'auto_1',
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

    const modelRuntime = {
      keyId: 'key_001',
      modelId: 'gpt-5.4',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    };

    await startChapterRun({
      projectPath: 'C:/novels/project',
      chapterId: 'ch_001',
      mode: 'generate',
      modelRuntime,
    });
    await startAutoMode('C:/novels/project', undefined, 'Approved premise', modelRuntime);

    expect(bodies[0]?.modelRuntime).toEqual(modelRuntime);
    expect(bodies[1]?.modelRuntime).toEqual(modelRuntime);
  });
});
