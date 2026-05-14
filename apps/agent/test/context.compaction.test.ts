import { describe, expect, it } from 'vitest';

describe('creative context and compaction', () => {
  it('selects relevant runtime context and preserves referenced artifacts separately', async () => {
    const { InMemoryArtifactStore } = await import('../src/artifact/store');
    const { buildSkillContext } = await import('../src/context/builder');

    const store = new InMemoryArtifactStore();
    store.write({
      id: 'outline-1',
      type: 'outline',
      title: 'Main outline',
      content: 'Three-act outline',
      tags: ['story', 'main'],
    });
    store.write({
      id: 'ref-1',
      type: 'reference',
      title: 'Tone guide',
      content: 'Noir references',
      tags: ['tone'],
    });

    const context = buildSkillContext({
      sessionId: 'session-1',
      runStatus: 'running',
      recentSummary: 'The protagonist has just reached the inciting incident.',
      requestedArtifactIds: ['outline-1'],
      referenceArtifactIds: ['ref-1'],
      artifactStore: store,
    });

    expect(context.runtime.sessionId).toBe('session-1');
    expect(context.runtime.runStatus).toBe('running');
    expect(context.summary).toContain('inciting incident');
    expect(context.artifacts.map((item) => item.id)).toEqual(['outline-1']);
    expect(context.references.map((item) => item.id)).toEqual(['ref-1']);
  });

  it('creates continuation snapshots and restores compacted state without replaying full history', async () => {
    const { createContinuationSnapshot, restoreContinuationSnapshot } = await import('../src/context/continuation');
    const { compactConversation } = await import('../src/context/compaction');

    const messages = [
      { id: 'u1', role: 'user', content: 'Set up the world.', createdAt: 1 },
      { id: 'a1', role: 'assistant', content: 'World established.', createdAt: 2 },
      { id: 'u2', role: 'user', content: 'Now focus on the heroine.', createdAt: 3 },
      { id: 'a2', role: 'assistant', content: 'Heroine arc drafted.', createdAt: 4 },
    ];

    const compacted = compactConversation({
      sessionId: 'session-1',
      messages,
      preserveLast: 1,
    });

    expect(compacted.summary).toContain('Set up the world.');
    expect(compacted.tail).toHaveLength(1);
    expect(compacted.tail[0]?.id).toBe('a2');

    const snapshot = createContinuationSnapshot({
      sessionId: 'session-1',
      compacted,
      workflowState: {
        activeSkill: 'story-setup',
        checkpoints: ['outline-approved'],
      },
    });

    const restored = restoreContinuationSnapshot(snapshot);
    expect(restored.sessionId).toBe('session-1');
    expect(restored.summary).toContain('Set up the world.');
    expect(restored.workflowState).toMatchObject({
      activeSkill: 'story-setup',
      checkpoints: ['outline-approved'],
    });
    expect(restored.tail).toHaveLength(1);
  });
});
