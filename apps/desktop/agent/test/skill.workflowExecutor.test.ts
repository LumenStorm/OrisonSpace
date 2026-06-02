import { describe, expect, it } from 'vitest';

describe('skill workflow executor', () => {
  it('executes a single skill, multi-step workflow, checkpoint, confirmation pause, and nested skill', async () => {
    const { SkillRegistry } = await import('../src/skill/runtime/registry');
    const { createWorkflowExecutor } = await import('../src/skill/runtime/workflowExecutor');

    const registry = new SkillRegistry();
    registry.register({
      format: 'manifest',
      name: 'story-setup',
      description: 'Prepare the story context',
      location: 'I:/skills/story-setup',
      entryPath: 'I:/skills/story-setup/skill.json',
      prompt: 'Collect story context.',
      workflowMode: 'workflow',
      assets: { references: [], scripts: [] },
      workflow: {
        steps: [
          { id: 'intro', type: 'prompt', content: 'Collect story context.' },
          { id: 'pause', type: 'checkpoint', label: 'context-collected' },
          { id: 'confirm', type: 'confirm', toolName: 'write_file', input: { filePath: 'story.md' } },
          { id: 'nested', type: 'skill', skill: 'scene-expander', input: 'Expand the first scene.' },
        ],
      },
    });

    registry.register({
      format: 'directory',
      name: 'scene-expander',
      description: 'Expand scene beats',
      location: 'I:/skills/scene-expander',
      entryPath: 'I:/skills/scene-expander/SKILL.md',
      prompt: 'Expand the first scene.',
      workflowMode: 'prompt',
      assets: { references: [], scripts: [] },
    });

    let observedSummary = '';
    const executor = createWorkflowExecutor({
      registry,
      executePrompt: async (prompt, _skill, context) => {
        observedSummary = context.skillContext?.summary ?? '';
        return `prompt:${prompt}`;
      },
      executeTool: async (_toolName, input) => `tool:${JSON.stringify(input)}`,
      requestConfirmation: async (toolName, input) => ({
        approved: true,
        pending: {
          sessionId: 'session-1',
          callId: 'confirm-1',
          name: toolName,
          input,
          createdAt: Date.now(),
        },
      }),
    });

    const result = await executor.executeSkill('story-setup', {
      sessionId: 'session-1',
      skillContext: {
        runtime: {
          sessionId: 'session-1',
          runStatus: 'running',
        },
        summary: 'Checkpoint: outline-ready',
        artifacts: [],
        references: [],
      },
    });

    expect(result.status).toBe('completed');
    expect(observedSummary).toContain('outline-ready');
    expect(result.checkpoints).toEqual(['context-collected']);
    expect(result.pendingConfirmations).toHaveLength(1);
    expect(result.outputs).toEqual([
      'prompt:Collect story context.',
      'prompt:Expand the first scene.',
    ]);
    expect(result.nested).toHaveLength(1);
    expect(result.nested[0]).toMatchObject({
      skill: 'scene-expander',
      status: 'completed',
    });
  });

  it('pauses on ask_user during the first run and resumes remaining nodes after user input', async () => {
    const { SkillRegistry } = await import('../src/skill/runtime/registry');
    const { createWorkflowExecutor } = await import('../src/skill/runtime/workflowExecutor');

    const registry = new SkillRegistry();
    registry.register({
      format: 'manifest',
      name: 'story-long-write',
      description: 'Generate a long-form novel',
      location: 'I:/skills/oh-story-claudecode-main/skills/story-long-write',
      entryPath: 'I:/skills/oh-story-claudecode-main/skills/story-long-write/skill.json',
      prompt: 'Write the novel.',
      workflowMode: 'workflow',
      assets: { references: [], scripts: [] },
      compiledPlan: {
        entryNodeId: 'instruction',
        nodes: [
          { id: 'instruction', type: 'instruction', content: 'Ask for story setup first.' },
          { id: 'clarify', type: 'ask_user', question: '你想写什么类型？' },
          { id: 'chapter-write', type: 'spawn_agent', agentType: 'build', prompt: 'Write chapter 1.' },
          { id: 'finish', type: 'finish' },
        ],
        edges: [],
      },
    });

    const observedSuppressAllTools: boolean[] = [];
    const executor = createWorkflowExecutor({
      registry,
      executePrompt: async (_prompt, _skill, context) => {
        observedSuppressAllTools.push(Boolean(context.suppressAllTools));
        return 'prompt:ok';
      },
      executeTool: async () => 'tool:ok',
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
        content: `spawned:${agentType}:${prompt}`,
        status: 'completed',
      }),
    });

    const firstRun = await executor.executeSkill('story-long-write', {
      sessionId: 'session-1',
      input: '生成50章的小说，男主角叫林浩',
    });

    expect(firstRun.status).toBe('completed');
    expect(observedSuppressAllTools).toEqual([true]);
    expect(firstRun.outputs).toEqual(['prompt:ok']);
    expect(firstRun.pendingConfirmations).toHaveLength(1);
    expect(firstRun.nested).toHaveLength(0);

    const secondRun = await executor.executeSkill('story-long-write', {
      sessionId: 'session-1',
      input: '起点男频，17万字，高频爽点',
      skillContext: {
        runtime: {
          sessionId: 'session-1',
          runStatus: 'running',
        },
        summary: '',
        artifacts: [],
        references: [],
        skillRunState: firstRun.skillRunState,
      },
    });

    expect(secondRun.outputs).toEqual(['spawned:build:Write chapter 1.']);
    expect(secondRun.pendingConfirmations).toHaveLength(0);
    expect(secondRun.nested).toEqual([{ skill: 'build', status: 'completed' }]);
  });
});
