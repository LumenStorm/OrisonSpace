import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('skill workflow vm', () => {
  let root = '';
  let skillDir = '';
  let referencePath = '';

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-vm-'));
    skillDir = path.join(root, 'story-skill');
    referencePath = path.join(skillDir, 'references', 'opening-design.md');
    mkdirSync(path.dirname(referencePath), { recursive: true });
    writeFileSync(referencePath, `# Opening Design

hook line
second line
`, 'utf-8');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('executes instruction, load_reference, delegate_skill, ask_user, spawn_agent, and checkpoint nodes from compiled plans', async () => {
    const { SkillRegistry } = await import('../src/skill/runtime/registry');
    const { createWorkflowExecutor } = await import('../src/skill/runtime/workflowExecutor');

    const registry = new SkillRegistry();
    registry.register({
      format: 'directory',
      name: 'story-skill',
      description: 'Compiled workflow skill',
      location: skillDir,
      entryPath: path.join(skillDir, 'SKILL.md'),
      prompt: 'ignored legacy prompt',
      workflowMode: 'workflow',
      assets: { references: [referencePath], scripts: [] },
      rawSource: 'Phase 1',
      capabilities: ['load_reference', 'delegate_skill', 'ask_user', 'spawn_agent'],
      compiledPlan: {
        entryNodeId: 'phase-1',
        nodes: [
          { id: 'phase-1', type: 'instruction', title: 'Phase 1', content: 'Draft an opening.' },
          { id: 'phase-1-ref', type: 'load_reference', path: 'references/opening-design.md', mode: 'summary' },
          { id: 'phase-1-skill', type: 'delegate_skill', skillName: 'scene-expander', input: 'Expand scene beats.' },
          { id: 'phase-1-ask', type: 'ask_user', question: '继续吗？' },
          { id: 'phase-1-agent', type: 'spawn_agent', agentType: 'narrative-writer', prompt: 'Write the next chapter.' },
          { id: 'phase-1-checkpoint', type: 'checkpoint', label: 'phase-1-ready' },
          { id: 'finish', type: 'finish' },
        ],
        edges: [
          { from: 'phase-1', to: 'phase-1-ref' },
          { from: 'phase-1-ref', to: 'phase-1-skill' },
          { from: 'phase-1-skill', to: 'phase-1-ask' },
          { from: 'phase-1-ask', to: 'phase-1-agent' },
          { from: 'phase-1-agent', to: 'phase-1-checkpoint' },
          { from: 'phase-1-checkpoint', to: 'finish' },
        ],
      },
    });

    registry.register({
      format: 'manifest',
      name: 'scene-expander',
      description: 'Expand scene beats',
      location: path.join(root, 'scene-expander'),
      entryPath: path.join(root, 'scene-expander', 'skill.json'),
      prompt: 'Expand scene beats.',
      workflowMode: 'prompt',
      assets: { references: [], scripts: [] },
    });

    const executor = createWorkflowExecutor({
      registry,
      executePrompt: async (prompt) => `prompt:${prompt}`,
      executeTool: async (_toolName, input) => `tool:${JSON.stringify(input)}`,
      requestConfirmation: async (_toolName, input) => ({
        approved: true,
        pending: {
          sessionId: 'session-1',
          callId: 'confirm-1',
          name: 'ask_user',
          input,
          createdAt: Date.now(),
        },
      }),
      dispatchAgent: async (agentType, prompt) => ({
        content: `subagent:${agentType}:${prompt}`,
        status: 'completed',
      }),
    });

    const skillContext = {
      runtime: { sessionId: 'session-1', runStatus: 'running' as const },
      summary: 'Checkpoint: outline-ready',
      artifacts: [],
      references: [],
      resolvedReferences: [],
      referenceCache: new Map(),
    };

    const result = await executor.executeSkill('story-skill', {
      sessionId: 'session-1',
      input: '写一个抓人的开头',
      skillContext,
    });

    expect(result.status).toBe('completed');
    expect(result.outputs).toEqual(expect.arrayContaining([
      'prompt:Draft an opening.',
      'prompt:Expand scene beats.',
    ]));
    expect(skillContext.resolvedReferences).toHaveLength(1);
    expect(skillContext.resolvedReferences[0]?.content).toContain('Opening Design');
    expect(result.pendingConfirmations).toHaveLength(1);
    expect(result.nested).toEqual(expect.arrayContaining([
      expect.objectContaining({ skill: 'scene-expander', status: 'completed' }),
    ]));
    expect(result.skillRunState?.currentNodeId).toBe('phase-1-ask');
    expect(result.checkpoints).not.toContain('phase-1-ready');
  });

  it('resolves references before the instruction prompt runs so they can be injected', async () => {
    const { SkillRegistry } = await import('../src/skill/runtime/registry');
    const { createWorkflowExecutor } = await import('../src/skill/runtime/workflowExecutor');

    const registry = new SkillRegistry();
    registry.register({
      format: 'directory',
      name: 'story-skill',
      description: 'Reference-first workflow skill',
      location: skillDir,
      entryPath: path.join(skillDir, 'SKILL.md'),
      prompt: 'ignored legacy prompt',
      workflowMode: 'workflow',
      assets: { references: [referencePath], scripts: [] },
      rawSource: 'Phase 1',
      capabilities: ['load_reference'],
      compiledPlan: {
        // load_reference now precedes the instruction (compiler emits it first).
        entryNodeId: 'phase-1-ref',
        nodes: [
          { id: 'phase-1-ref', type: 'load_reference', path: 'references/opening-design.md', mode: 'full' },
          { id: 'phase-1', type: 'instruction', title: 'Phase 1', content: 'Draft an opening.' },
          { id: 'finish', type: 'finish' },
        ],
        edges: [
          { from: 'phase-1-ref', to: 'phase-1' },
          { from: 'phase-1', to: 'finish' },
        ],
      },
    });

    // Capture how many references were resolved at the moment the instruction
    // prompt executes — this is what the runtime's executePrompt injects.
    let referencesVisibleToPrompt = -1;
    const executor = createWorkflowExecutor({
      registry,
      executePrompt: async (prompt, _skill, context) => {
        referencesVisibleToPrompt = context.skillContext?.resolvedReferences.length ?? 0;
        return `prompt:${prompt}`;
      },
      executeTool: async (_toolName, input) => `tool:${JSON.stringify(input)}`,
      requestConfirmation: async (_toolName, input) => ({
        approved: true,
        pending: { sessionId: 'session-1', callId: 'c1', name: 'x', input, createdAt: Date.now() },
      }),
    });

    const skillContext = {
      runtime: { sessionId: 'session-1', runStatus: 'running' as const },
      summary: '',
      artifacts: [],
      references: [],
      resolvedReferences: [],
      referenceCache: new Map(),
    };

    await executor.executeSkill('story-skill', { sessionId: 'session-1', skillContext });

    expect(referencesVisibleToPrompt).toBe(1);
    expect(skillContext.resolvedReferences[0]?.content).toContain('Opening Design');
  });

  it('captures node-level continuation at ask_user and resumes from the next node without reloading references', async () => {
    const { SkillRegistry } = await import('../src/skill/runtime/registry');
    const { createWorkflowExecutor } = await import('../src/skill/runtime/workflowExecutor');

    const registry = new SkillRegistry();
    registry.register({
      format: 'directory',
      name: 'story-skill',
      description: 'Compiled workflow skill',
      location: skillDir,
      entryPath: path.join(skillDir, 'SKILL.md'),
      prompt: 'ignored legacy prompt',
      workflowMode: 'workflow',
      assets: { references: [referencePath], scripts: [] },
      rawSource: 'Phase 1',
      capabilities: ['load_reference', 'ask_user', 'spawn_agent'],
      compiledPlan: {
        entryNodeId: 'phase-1',
        nodes: [
          { id: 'phase-1', type: 'instruction', title: 'Phase 1', content: 'Draft an opening.' },
          { id: 'phase-1-ref', type: 'load_reference', path: 'references/opening-design.md', mode: 'summary' },
          { id: 'phase-1-ask', type: 'ask_user', question: '继续吗？' },
          { id: 'phase-1-agent', type: 'spawn_agent', agentType: 'narrative-writer', prompt: 'Write the next chapter.' },
          { id: 'phase-1-checkpoint', type: 'checkpoint', label: 'phase-1-ready' },
          { id: 'finish', type: 'finish' },
        ],
        edges: [
          { from: 'phase-1', to: 'phase-1-ref' },
          { from: 'phase-1-ref', to: 'phase-1-ask' },
          { from: 'phase-1-ask', to: 'phase-1-agent' },
          { from: 'phase-1-agent', to: 'phase-1-checkpoint' },
          { from: 'phase-1-checkpoint', to: 'finish' },
        ],
      },
    });

    let promptCalls = 0;
    let spawnCalls = 0;
    const executor = createWorkflowExecutor({
      registry,
      executePrompt: async (prompt) => {
        promptCalls += 1;
        return `prompt:${prompt}`;
      },
      executeTool: async (_toolName, input) => `tool:${JSON.stringify(input)}`,
      requestConfirmation: async (_toolName, input) => ({
        approved: true,
        pending: {
          sessionId: 'session-1',
          callId: 'confirm-1',
          name: 'ask_user',
          input,
          createdAt: Date.now(),
        },
      }),
      dispatchAgent: async (agentType, prompt) => {
        spawnCalls += 1;
        return {
          content: `subagent:${agentType}:${prompt}`,
          status: 'completed',
        };
      },
    });

    const initialContext = {
      runtime: { sessionId: 'session-1', runStatus: 'running' as const },
      summary: 'Checkpoint: outline-ready',
      artifacts: [],
      references: [],
      resolvedReferences: [],
      referenceCache: new Map(),
    };

    const first = await executor.executeSkill('story-skill', {
      sessionId: 'session-1',
      skillContext: initialContext,
    });

    expect(first.pendingConfirmations).toHaveLength(1);
    expect(first.skillRunState?.currentNodeId).toBe('phase-1-ask');
    expect(first.skillRunState?.completedNodeIds).toEqual(['phase-1', 'phase-1-ref']);
    expect(first.skillRunState?.resolvedReferences).toHaveLength(1);
    expect(promptCalls).toBe(1);
    expect(spawnCalls).toBe(0);

    const resumedContext = {
      runtime: { sessionId: 'session-1', runStatus: 'running' as const },
      summary: 'Checkpoint: outline-ready',
      artifacts: [],
      references: [],
      resolvedReferences: [...(first.skillRunState?.resolvedReferences ?? [])],
      referenceCache: new Map((first.skillRunState?.resolvedReferences ?? []).map((item) => [item.key, item])),
      skillRunState: first.skillRunState,
    };

    const resumed = await executor.executeSkill('story-skill', {
      sessionId: 'session-1',
      input: '继续',
      skillContext: resumedContext,
    });

    expect(promptCalls).toBe(1);
    expect(spawnCalls).toBe(1);
    expect(resumed.pendingConfirmations).toHaveLength(0);
    expect(resumed.outputs).toEqual(['subagent:narrative-writer:Write the next chapter.']);
    expect(resumed.checkpoints).toContain('phase-1-ready');
    expect(resumed.skillRunState?.completedNodeIds).toEqual([
      'phase-1',
      'phase-1-ref',
      'phase-1-ask',
      'phase-1-agent',
      'phase-1-checkpoint',
      'finish',
    ]);
    expect(resumed.skillRunState?.currentNodeId).toBeUndefined();
    expect(resumed.skillRunState?.resolvedReferences).toHaveLength(1);
  });
});
