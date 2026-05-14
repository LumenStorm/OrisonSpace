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
});
