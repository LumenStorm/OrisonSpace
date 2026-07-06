import { describe, expect, it, vi } from 'vitest';
import { skillTool } from '../src/tool/skill';
import type { ToolContext } from '../src/types';

describe('skill tool native loading', () => {
  function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
    return {
      sessionId: 'session-1',
      projectPath: 'I:/proj',
      abort: new AbortController().signal,
      ...overrides,
    };
  }

  it('loads a skill payload and exposes active skill metadata without terminal execution', async () => {
    const emitConfirmation = vi.fn();
    const loadSkill = vi.fn(async () => ({
      format: 'directory',
      name: 'story',
      description: 'Story guidance',
      location: 'I:/proj/.orison/skills/story',
      entryPath: 'I:/proj/.orison/skills/story/SKILL.md',
      prompt: '# Story\n\nFollow the story guidance.',
      workflowMode: 'prompt',
      assets: { references: [], scripts: [], assets: [] },
      allowedTools: ['read_file'],
    }));

    const ctx = makeCtx({
      skillExecutor: { loadSkill, executeSkillByName: vi.fn(), runSubagent: vi.fn() } as any,
      emitConfirmation,
    });

    const result = await skillTool.execute({ name: 'story', input: 'go' }, ctx);

    expect(loadSkill).toHaveBeenCalledWith('session-1', 'story');
    expect(emitConfirmation).not.toHaveBeenCalled();
    expect(result.output).toContain('# Skill: story');
    expect(result.output).toContain('# Story');
    expect(result.metadata).toEqual({
      activeSkill: {
        name: 'story',
        allowedTools: ['read_file'],
      },
    });
    expect(result.terminal).toBeUndefined();
  });

  it('does not throw when no emitConfirmation channel is wired', async () => {
    const loadSkill = vi.fn(async () => ({
      format: 'directory',
      name: 'story',
      location: 'I:/proj/.orison/skills/story',
      entryPath: 'I:/proj/.orison/skills/story/SKILL.md',
      prompt: 'Story body.',
      workflowMode: 'prompt',
      assets: { references: [], scripts: [], assets: [] },
    }));
    const ctx = makeCtx({ skillExecutor: { loadSkill, executeSkillByName: vi.fn(), runSubagent: vi.fn() } as any });

    await expect(skillTool.execute({ name: 'story', input: 'go' }, ctx)).resolves.toBeTruthy();
  });
});
