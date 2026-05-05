import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TextGenerationResponse } from '@orison/shared-contracts';
import type { NodeRunInput } from '../src/contracts/run';

const ORIG = { ...process.env };

afterEach(() => {
  process.env = { ...ORIG };
  vi.resetModules();
});

function makeInput(): NodeRunInput {
  const base: any = {
    runId: 'run_1',
    artifacts: {
      'context.chapterContext': {
        chapterId: 'ch_1',
        chapterNumber: 4,
        foreshadowRegistry: { items: [], version: 2 },
      },
      'chapter.candidate': {
        chapterId: 'ch_1',
        content: '他取出一把铜钥匙打开木匣。',
      },
    },
  };
  return { run: base, requirement: '' };
}

describe('createStorySyncNode dispatcher', () => {
  it('uses rules path by default when ORISON_STORY_SYNC_MODE is unset', async () => {
    delete process.env.ORISON_STORY_SYNC_MODE;
    delete process.env.ORISON_LLM_SERVER_URL;
    vi.resetModules();
    const { createStorySyncNode } = await import('../src/nodes/story-sync-agent');
    const node = createStorySyncNode();
    const result = await node.run(makeInput());
    const artifact = result.artifact as any;
    expect(result.stateKey).toBe('story.sync');
    expect(artifact.chapterId).toBe('ch_1');
    expect(Array.isArray(artifact.patches)).toBe(true);
    expect(artifact.patches.length).toBeGreaterThan(0);
    expect(artifact.patches.every((p: any) => p.action === 'merge')).toBe(true);
  });

  it('LLM mode falls back to rules when LLM call throws', async () => {
    process.env.ORISON_STORY_SYNC_MODE = 'llm';
    process.env.ORISON_LLM_SERVER_URL = 'http://127.0.0.1:9999';
    vi.resetModules();
    const { createStorySyncNode } = await import('../src/nodes/story-sync-agent');
    const node = createStorySyncNode({
      generateText: async () => {
        throw new Error('boom');
      },
    });
    const result = await node.run(makeInput());
    const artifact = result.artifact as any;
    expect(artifact.patches.length).toBeGreaterThan(0);
    expect(artifact.summary).toMatch(/derived|no field/);
  });

  it('LLM mode uses LLM patches when response is well-formed', async () => {
    process.env.ORISON_STORY_SYNC_MODE = 'llm';
    process.env.ORISON_LLM_SERVER_URL = 'http://127.0.0.1:9999';
    vi.resetModules();
    const { createStorySyncNode } = await import('../src/nodes/story-sync-agent');

    const mockResponse: TextGenerationResponse = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      text: JSON.stringify({
        summary: 'llm_ok',
        patches: [
          {
            field: 'foreshadow_registry',
            action: 'merge',
            data: { items: [{ id: 'fs_llm_1', title: 'LLM 钥匙', content: '一把钥匙' }] },
            fieldVersion: 2,
            generatedBy: 'IMPERSONATOR',
          },
        ],
      }),
    };

    const node = createStorySyncNode({ generateText: async () => mockResponse });
    const result = await node.run(makeInput());
    const artifact = result.artifact as any;
    expect(artifact.patches).toHaveLength(1);
    expect(artifact.patches[0].generatedBy).toBe('story-sync-agent');
    expect(artifact.summary).toBe('llm_ok');
  });

  it('LLM mode drops patches whose fieldVersion is stale', async () => {
    process.env.ORISON_STORY_SYNC_MODE = 'llm';
    process.env.ORISON_LLM_SERVER_URL = 'http://127.0.0.1:9999';
    vi.resetModules();
    const { createStorySyncNode } = await import('../src/nodes/story-sync-agent');

    const mockResponse: TextGenerationResponse = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      text: JSON.stringify({
        summary: 'llm_stale',
        patches: [
          {
            field: 'foreshadow_registry',
            action: 'merge',
            data: { items: [{ id: 'fs_llm_2', title: '钥匙', content: '一把钥匙' }] },
            fieldVersion: 99,
            generatedBy: 'story-sync-agent',
          },
        ],
      }),
    };

    const node = createStorySyncNode({ generateText: async () => mockResponse });
    const result = await node.run(makeInput());
    const artifact = result.artifact as any;
    expect(artifact.summary).toBe('llm_stale');
    expect(artifact.patches).toEqual([]);
  });

  it('returns skip artifact when chapter.candidate is missing', async () => {
    delete process.env.ORISON_STORY_SYNC_MODE;
    vi.resetModules();
    const { createStorySyncNode } = await import('../src/nodes/story-sync-agent');
    const node = createStorySyncNode();
    const input: any = {
      run: {
        runId: 'run_2',
        artifacts: {
          'context.chapterContext': { chapterId: 'ch_x' },
        },
      },
      requirement: '',
    };
    const result = await node.run(input as NodeRunInput);
    const artifact = result.artifact as any;
    expect(artifact.summary).toMatch(/skip/);
    expect(artifact.patches).toEqual([]);
  });
});
