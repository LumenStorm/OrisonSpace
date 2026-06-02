import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/skill/discovery', () => ({
  discoverSkills: vi.fn(async () => []),
}));

describe('runtime workflow run state', () => {
  let projectPath = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-runtime-workflow-'));
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
    vi.resetModules();
  });

  it('marks a session as running and prevents overlapping runs', async () => {
    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const runtime = createWorkflowRuntime({
      generate: vi.fn(async () => ({
        content: 'Completed.',
        finishReason: 'stop',
      })),
    });

    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
    });

    let releaseFirstRun: (() => void) | undefined;
    const blockingRuntime = createWorkflowRuntime({
      generate: vi.fn((_messages, _system, _tools, abortSignal) => new Promise((resolve, reject) => {
        const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
        abortSignal.addEventListener('abort', onAbort, { once: true });
        releaseFirstRun = () => {
          abortSignal.removeEventListener('abort', onAbort);
          resolve({
            content: 'Released.',
            finishReason: 'stop',
          });
        };
      })),
    });

    const blockingSession = blockingRuntime.createSession({
      agentName: 'writer',
      projectPath,
    });

    const firstRun = blockingRuntime.sendMessage({
      sessionId: blockingSession.id,
      content: 'Hold this run open.',
      abortSignal: new AbortController().signal,
    });

    expect(blockingRuntime.getRunState(blockingSession.id)?.status).toBe('running');

    await expect(blockingRuntime.sendMessage({
      sessionId: blockingSession.id,
      content: 'Start again before the first finishes.',
      abortSignal: new AbortController().signal,
    })).rejects.toThrow(/already active/i);

    // Wait until the generate mock has been entered and releaseFirstRun is wired
    // (sendMessage awaits system-prompt build before invoking generate; this can
    // race with the synchronous overlap check above).
    await vi.waitFor(() => {
      if (!releaseFirstRun) throw new Error('generate not yet entered');
    }, { timeout: 5000, interval: 10 });
    releaseFirstRun!();
    await firstRun;

    await runtime.sendMessage({
      sessionId: session.id,
      content: 'Simple run.',
      abortSignal: new AbortController().signal,
    });

    expect(runtime.getRunState(session.id)?.status).toBe('completed');
  });

  it('aborts an in-flight run and keeps a resume checkpoint skeleton', async () => {
    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const runtime = createWorkflowRuntime({
      generate: vi.fn((_messages, _system, _tools, abortSignal) => new Promise((_resolve, reject) => {
        abortSignal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      })),
    });

    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
    });

    const runPromise = runtime.sendMessage({
      sessionId: session.id,
      content: 'Abort this run.',
      abortSignal: new AbortController().signal,
    });

    expect(runtime.getRunState(session.id)?.status).toBe('running');
    expect(runtime.abortRun(session.id)).toBe(true);
    await expect(runPromise).rejects.toThrow(/aborted/i);

    const snapshot = runtime.getRunState(session.id);
    expect(snapshot?.status).toBe('aborted');
    expect(snapshot?.checkpoint).toMatchObject({
      sessionId: session.id,
      stage: 'loop',
    });

    const resumed = runtime.resumeRun(session.id);
    expect(resumed).toMatchObject({
      sessionId: session.id,
      stage: 'loop',
    });
    expect(runtime.getRunState(session.id)?.status).toBe('idle');
  });

  it('builds skill context from stored artifacts and creates continuation snapshots after skill execution', async () => {
    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { SkillRegistry } = await import('../src/skill/runtime/registry');
    const { InMemoryArtifactStore } = await import('../src/artifact/store');

    const skillRegistry = new SkillRegistry();
    skillRegistry.register({
      format: 'manifest',
      name: 'story-setup',
      description: 'Prepare the story context',
      location: 'I:/skills/story-setup',
      entryPath: 'I:/skills/story-setup/skill.json',
      prompt: 'Prepare the story context.',
      workflowMode: 'workflow',
      assets: { references: [], scripts: [] },
    });

    const artifactStore = new InMemoryArtifactStore();
    artifactStore.write({
      id: 'outline-1',
      type: 'outline',
      title: 'Main outline',
      content: 'Three-act outline',
      tags: ['story'],
    });
    artifactStore.write({
      id: 'ref-1',
      type: 'reference',
      title: 'Tone guide',
      content: 'Noir references',
      tags: ['tone'],
    });

    const runtime = createWorkflowRuntime({
      generate: vi.fn(async (messages) => ({
        content: messages[messages.length - 1]?.content ?? 'Checkpoint: outline-ready',
        finishReason: 'stop',
      })),
      skillRegistry,
      artifactStore,
    });

    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
    });

    await runtime.sendMessage({
      sessionId: session.id,
      content: 'Draft a setup first.',
      abortSignal: new AbortController().signal,
    });

    const context = runtime.buildSkillContext(session.id, ['outline-1'], ['ref-1']);
    expect(context.runtime.runStatus).toBe('completed');
    expect(context.summary).toBe('');
    expect(context.artifacts.map((item) => item.id)).toEqual(['outline-1']);
    expect(context.references.map((item) => item.id)).toEqual(['ref-1']);

    const result = await runtime.executeSkillByName(
      session.id,
      'story-setup',
      {
        input: 'Focus on a noir opening.',
        artifactIds: ['outline-1'],
        referenceIds: ['ref-1'],
      },
    );
    expect(result.outputs[0]).toContain('Focus on a noir opening.');
    expect(artifactStore.read('outline-1')?.runId).toBe(session.id);
    expect(artifactStore.read('ref-1')?.runId).toBe(session.id);

    const snapshot = runtime.createContinuationSnapshot(session.id, {
      activeSkill: 'story-setup',
      checkpoints: ['story-setup:completed'],
    });
    const restored = runtime.restoreContinuationSnapshot(snapshot);
    expect(restored.workflowState.activeSkill).toBe('story-setup');
    expect(restored.workflowState.checkpoints).toEqual(['story-setup:completed']);
    expect(restored.tail.length).toBeGreaterThan(0);
  });

  it('persists a first-run ask_user pause and resumes the skill on the next invocation', async () => {
    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { SkillRegistry } = await import('../src/skill/runtime/registry');

    const skillRegistry = new SkillRegistry();
    skillRegistry.register({
      format: 'manifest',
      name: 'story-long-write',
      description: 'Pause for setup first, then continue.',
      location: 'I:/skills/oh-story-claudecode-main/skills/story-long-write',
      entryPath: 'I:/skills/oh-story-claudecode-main/skills/story-long-write/SKILL.md',
      prompt: 'Ask for setup before writing.',
      workflowMode: 'workflow',
      assets: { references: [], scripts: [] },
      compiledPlan: {
        entryNodeId: 'instruction',
        nodes: [
          { id: 'instruction', type: 'instruction', content: '先收集设定。' },
          { id: 'clarify', type: 'ask_user', question: '你想写什么类型？' },
          { id: 'writer', type: 'instruction', content: '根据用户设定继续写作。' },
          { id: 'finish', type: 'finish' },
        ],
        edges: [],
      },
    });

    const runtime = createWorkflowRuntime({
      generate: vi.fn(async (messages, _system, tools) => ({
        content: JSON.stringify({
          lastUserMessage: messages[messages.length - 1]?.content ?? '',
          toolCount: tools.length,
        }),
        finishReason: 'stop',
      })),
      skillRegistry,
    });

    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
    });

    const firstRun = await runtime.executeSkillByName(session.id, 'story-long-write', '生成50章的小说');
    expect(firstRun.pendingConfirmations).toHaveLength(1);
    expect(firstRun.outputs).toHaveLength(1);
    expect(firstRun.outputs[0]).toContain('"toolCount":0');

    const secondRun = await runtime.executeSkillByName(session.id, 'story-long-write', '起点男频，17万字，诡异修仙');
    expect(secondRun.pendingConfirmations).toHaveLength(0);
    expect(secondRun.outputs).toEqual([
      expect.stringContaining('起点男频，17万字，诡异修仙'),
    ]);
    expect(secondRun.outputs[0]).toContain('根据用户设定继续写作');
  });
});
