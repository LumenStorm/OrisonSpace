import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('native skill loading', () => {
  let projectPath = '';
  let homePath = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-native-skill-'));
    homePath = mkdtempSync(path.join(os.tmpdir(), 'orison-native-home-'));
    vi.doMock('node:os', async () => {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      return {
        ...actual,
        default: {
          ...actual.default,
          homedir: () => homePath,
        },
        homedir: () => homePath,
      };
    });
  });

  afterEach(async () => {
    const { closeDb } = await import('../src/agent/persistence');
    closeDb(projectPath);
    rmSync(projectPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    rmSync(homePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    vi.resetModules();
  });

  it('loads a SKILL.md into the conversation instead of executing it as a workflow', async () => {
    const skillDir = path.join(projectPath, '.orison', 'story-tools', 'skills', 'brand-voice');
    mkdirSync(path.join(skillDir, 'references'), { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: brand-voice',
      'description: Keep prose consistent with the project voice guide',
      'allowed-tools:',
      '  - read_file',
      '  - skill_resource_read',
      '---',
      '',
      '# Brand Voice',
      '',
      'Read `references/voice.md` only when style details are needed.',
    ].join('\n'), 'utf-8');
    writeFileSync(path.join(skillDir, 'references', 'voice.md'), 'Use short concrete sentences.', 'utf-8');

    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        content: '',
        finishReason: 'tool-calls',
        toolCalls: [{
          id: 'call-load-skill',
          name: 'skill',
          arguments: JSON.stringify({ name: 'brand-voice' }),
        }],
      })
      .mockResolvedValueOnce({
        content: 'Loaded the brand voice skill and will follow it.',
        finishReason: 'stop',
      });

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { registerBuiltinTools } = await import('../src/tool/builtin');
    registerBuiltinTools();

    const runtime = createWorkflowRuntime({ generate });
    const session = runtime.createSession({ agentName: 'writer', projectPath });

    await runtime.sendMessage({
      sessionId: session.id,
      content: 'Use the brand voice rules.',
      abortSignal: new AbortController().signal,
    });

    const messages = runtime.getSession(session.id)?.messages ?? [];
    const skillToolMessage = messages.find((msg) =>
      msg.role === 'tool' &&
      msg.toolResults?.some((result) => result.toolName === 'skill'),
    );

    expect(skillToolMessage?.toolResults?.[0]?.output).toContain('# Skill: brand-voice');
    expect(skillToolMessage?.toolResults?.[0]?.output).toContain('# Brand Voice');
    expect(skillToolMessage?.toolResults?.[0]?.output).toContain('references/voice.md');
    expect(generate).toHaveBeenCalledTimes(2);
    expect(messages.at(-1)?.content).toBe('Loaded the brand voice skill and will follow it.');
  }, 15_000);

  it('keeps active skill allowed-tools restrictions across turns', async () => {
    const skillDir = path.join(projectPath, '.orison', 'skills', 'read-only-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: read-only-skill',
      'description: Restricts the agent to reading only',
      'allowed-tools:',
      '  - read_file',
      '---',
      '',
      'Only inspect files.',
    ].join('\n'), 'utf-8');

    const visibleToolsByCall: string[][] = [];
    const generate = vi.fn(async (_messages, _system, tools) => {
      visibleToolsByCall.push(tools.map((tool: any) => tool.id));
      if (visibleToolsByCall.length === 1) {
        return {
          content: '',
          finishReason: 'tool-calls',
          toolCalls: [{
            id: 'call-load-skill',
            name: 'skill',
            arguments: JSON.stringify({ name: 'read-only-skill' }),
          }],
        };
      }
      return { content: 'done', finishReason: 'stop' };
    });

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { registerBuiltinTools } = await import('../src/tool/builtin');
    registerBuiltinTools();

    const runtime = createWorkflowRuntime({ generate });
    const session = runtime.createSession({ agentName: 'writer', projectPath, mode: 'auto' });

    await runtime.sendMessage({
      sessionId: session.id,
      content: 'Load the read-only skill.',
      abortSignal: new AbortController().signal,
    });
    await runtime.sendMessage({
      sessionId: session.id,
      content: 'Continue with that skill.',
      abortSignal: new AbortController().signal,
    });

    expect(visibleToolsByCall[2]).toContain('read_file');
    expect(visibleToolsByCall[2]).not.toContain('write_file');
    expect(visibleToolsByCall[2]).not.toContain('chapter_write');
  });

  it('applies skill permission as a stricter runtime mode', async () => {
    const skillDir = path.join(projectPath, '.orison', 'skills', 'readonly-permission-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: readonly-permission-skill',
      'description: Explicit readonly permission',
      'permission: readonly',
      '---',
      '',
      'Never write while this skill is active.',
    ].join('\n'), 'utf-8');

    const visibleToolsByCall: string[][] = [];
    const generate = vi.fn(async (_messages, _system, tools) => {
      visibleToolsByCall.push(tools.map((tool: any) => tool.id));
      if (visibleToolsByCall.length === 1) {
        return {
          content: '',
          finishReason: 'tool-calls',
          toolCalls: [{
            id: 'call-load-skill',
            name: 'skill',
            arguments: JSON.stringify({ name: 'readonly-permission-skill' }),
          }],
        };
      }
      return { content: 'done', finishReason: 'stop' };
    });

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { registerBuiltinTools } = await import('../src/tool/builtin');
    registerBuiltinTools();

    const runtime = createWorkflowRuntime({ generate });
    const session = runtime.createSession({ agentName: 'writer', projectPath, mode: 'auto' });

    await runtime.sendMessage({
      sessionId: session.id,
      content: 'Load readonly skill.',
      abortSignal: new AbortController().signal,
    });

    expect(visibleToolsByCall[1]).toContain('read_file');
    expect(visibleToolsByCall[1]).not.toContain('write_file');
    expect(visibleToolsByCall[1]).not.toContain('rewrite_passage');
  });

  it('keeps skill resource tools visible under active skill allowed-tools', async () => {
    const skillDir = path.join(projectPath, '.orison', 'skills', 'resource-skill');
    mkdirSync(path.join(skillDir, 'references'), { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: resource-skill',
      'description: Reads its own references on demand',
      'allowed-tools:',
      '  - read_file',
      '---',
      '',
      'Read references/style.md when needed.',
    ].join('\n'), 'utf-8');
    writeFileSync(path.join(skillDir, 'references', 'style.md'), 'Use grounded detail.', 'utf-8');

    const visibleToolsByCall: string[][] = [];
    const generate = vi.fn(async (_messages, _system, tools) => {
      visibleToolsByCall.push(tools.map((tool: any) => tool.id));
      if (visibleToolsByCall.length === 1) {
        return {
          content: '',
          finishReason: 'tool-calls',
          toolCalls: [{
            id: 'call-load-skill',
            name: 'skill',
            arguments: JSON.stringify({ name: 'resource-skill' }),
          }],
        };
      }
      return { content: 'done', finishReason: 'stop' };
    });

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { registerBuiltinTools } = await import('../src/tool/builtin');
    registerBuiltinTools();

    const runtime = createWorkflowRuntime({ generate });
    const session = runtime.createSession({ agentName: 'writer', projectPath, mode: 'auto' });

    await runtime.sendMessage({
      sessionId: session.id,
      content: 'Load resource skill.',
      abortSignal: new AbortController().signal,
    });

    expect(visibleToolsByCall[1]).toContain('skill_resource_list');
    expect(visibleToolsByCall[1]).toContain('skill_resource_read');
  });

  it('continues generation after direct /skill invocation loads the skill', async () => {
    const skillDir = path.join(projectPath, '.orison', 'skills', 'direct-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: direct-skill',
      'description: Direct invocation guidance',
      '---',
      '',
      'Answer using this skill.',
    ].join('\n'), 'utf-8');

    const generate = vi.fn(async (messages) => {
      expect(messages.some((msg: any) =>
        msg.role === 'tool' &&
        msg.toolResults?.some((result: any) =>
          result.toolName === 'skill' &&
          result.output.includes('# Skill: direct-skill'),
        ),
      )).toBe(true);
      return { content: 'final answer after skill load', finishReason: 'stop' };
    });

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { registerBuiltinTools } = await import('../src/tool/builtin');
    registerBuiltinTools();

    const runtime = createWorkflowRuntime({ generate });
    const session = runtime.createSession({ agentName: 'writer', projectPath, mode: 'auto' });

    const result = await runtime.sendMessage({
      sessionId: session.id,
      content: '/skill direct-skill do the task',
      abortSignal: new AbortController().signal,
    });

    expect(generate).toHaveBeenCalledOnce();
    expect(result.messages.at(-1)?.content).toBe('final answer after skill load');
  });

  it('treats directory SKILL.md files as prompt skills without compiledPlan', async () => {
    const skillDir = path.join(projectPath, '.orison', 'skills', 'plain-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: plain-skill',
      'description: Plain skill with phase text that must not become a DAG',
      '---',
      '',
      '## Phase 1',
      'Read the project.',
      '',
      '## Phase 2',
      'Write the answer.',
    ].join('\n'), 'utf-8');

    const { loadSkillFromDir } = await import('../src/skill/loadSkillFromDir');
    const outcome = await loadSkillFromDir(skillDir, 'project');

    expect(outcome.kind).toBe('loaded');
    if (outcome.kind !== 'loaded') return;
    expect(outcome.skill.workflowMode).toBe('prompt');
    expect(outcome.skill.compiledPlan).toBeUndefined();
    expect(outcome.skill.prompt).toContain('## Phase 1');
  });

  it('does not rewrite authored skill names through a hardcoded story router', async () => {
    const root = path.join(projectPath, '.orison', 'story-pack', 'skills');
    const longWrite = path.join(root, 'story-long-write');
    const router = path.join(root, 'story');
    mkdirSync(longWrite, { recursive: true });
    mkdirSync(router, { recursive: true });

    writeFileSync(path.join(longWrite, 'SKILL.md'), [
      '---',
      'name: story-long-write',
      'description: Long-form novel writing workflow guidance',
      '---',
      'Long-form writing instructions.',
    ].join('\n'), 'utf-8');

    writeFileSync(path.join(router, 'SKILL.md'), [
      '---',
      'name: story',
      'description: Story skill index that explains which authored skill to load',
      '---',
      'If the user wants a long novel, load `story-long-write`.',
    ].join('\n'), 'utf-8');

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const runtime = createWorkflowRuntime();
    const session = runtime.createSession({ agentName: 'writer', projectPath });

    const names = await runtime.loadSkillsForSession(session.id);

    expect(names).toContain('story');
    expect(names).toContain('story-long-write');
    expect(names).not.toContain('story-write');
    expect(names).not.toContain('story-analyze');
    expect(names).not.toContain('story-revise');
  });
});
