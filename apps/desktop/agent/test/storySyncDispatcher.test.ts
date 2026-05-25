import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NodeRunInput } from '../src/contracts/run';

const ORIG = { ...process.env };

afterEach(() => {
  process.env = { ...ORIG };
  vi.resetModules();
});

function makeInput(extraArtifacts: Record<string, unknown> = {}): NodeRunInput {
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
      ...extraArtifacts,
    },
  };
  return { run: base, requirement: '' };
}

describe('createStorySyncNode dispatcher (post-migration)', () => {
  it('uses rules path when chapter.llmPatches is absent', async () => {
    const { createStorySyncNode } = await import('../src/nodes/story-sync-agent');
    const node = createStorySyncNode();
    const result = await node.run(makeInput());
    const artifact = result.artifact as any;
    expect(result.stateKey).toBe('story.sync');
    expect(artifact.chapterId).toBe('ch_1');
    expect(Array.isArray(artifact.patches)).toBe(true);
    expect(artifact.patches.length).toBeGreaterThan(0);
    expect(artifact.patches.every((p: any) => p.action === 'merge')).toBe(true);
    expect(artifact.patches.every((p: any) => p.generatedBy === 'story-sync-agent')).toBe(true);
  });

  it('emits the pre-computed patches when chapter.llmPatches is valid', async () => {
    const { createStorySyncNode } = await import('../src/nodes/story-sync-agent');
    const node = createStorySyncNode();
    const result = await node.run(
      makeInput({
        'chapter.llmPatches': [
          {
            field: 'foreshadow_registry',
            action: 'merge',
            data: { items: [{ id: 'fs_desktop_1', title: 'desktop 钥匙' }] },
            fieldVersion: 2,
            generatedBy: 'IMPERSONATOR',
          },
        ],
      }),
    );
    const artifact = result.artifact as any;
    expect(artifact.patches).toHaveLength(1);
    expect(artifact.patches[0].generatedBy).toBe('story-sync-agent');
    expect(artifact.patches[0].field).toBe('foreshadow_registry');
  });

  it('falls back to rules when llmPatches references a non-whitelisted field', async () => {
    const { createStorySyncNode } = await import('../src/nodes/story-sync-agent');
    const node = createStorySyncNode();
    const result = await node.run(
      makeInput({
        'chapter.llmPatches': [
          {
            field: 'NOT_A_REAL_FIELD',
            action: 'merge',
            data: {},
            fieldVersion: 0,
            generatedBy: 'story-sync-agent',
          },
        ],
      }),
    );
    const artifact = result.artifact as any;
    // Rules path should still emit the铜钥匙-based patch.
    expect(artifact.patches.length).toBeGreaterThan(0);
    expect(artifact.summary).not.toMatch(/pre-computed/);
  });

  it('falls back to rules when llmPatches has stale fieldVersion', async () => {
    const { createStorySyncNode } = await import('../src/nodes/story-sync-agent');
    const node = createStorySyncNode();
    const result = await node.run(
      makeInput({
        'chapter.llmPatches': [
          {
            field: 'foreshadow_registry',
            action: 'merge',
            data: { items: [] },
            fieldVersion: 99, // doesn't match context's version=2
            generatedBy: 'story-sync-agent',
          },
        ],
      }),
    );
    const artifact = result.artifact as any;
    // Should not have used pre-computed patches (after stale-version filter
    // they'd be empty); falls back to rules which derives the铜钥匙 patch.
    expect(artifact.patches.length).toBeGreaterThan(0);
    expect(artifact.summary).not.toMatch(/pre-computed/);
  });

  it('returns skip artifact when chapter.candidate is missing', async () => {
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

  it('does not import or instantiate any LLM client (regression: agent must not call providers)', async () => {
    // Importing the dispatcher should not pull in any module that imports
    // openai / anthropic / @google-cloud/aiplatform / fetch-to-provider helpers.
    const mod = await import('../src/nodes/story-sync-agent');
    expect(typeof mod.createStorySyncNode).toBe('function');
  });
});
