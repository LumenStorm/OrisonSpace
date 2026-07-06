import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('runtime permission service', () => {
  let projectPath = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-runtime-permission-'));
  });

  afterEach(async () => {
    const { closeDb } = await import('../src/agent/persistence');
    closeDb(projectPath);
    rmSync(projectPath, { recursive: true, force: true });
    vi.resetModules();
  });

  it('supports allow, ask, deny, and pending confirmation storage', async () => {
    const { createPermissionService } = await import('../src/runtime/permission');
    const service = createPermissionService({
      rules: [
        { action: 'allow', class: 'read', pattern: /^read_/ },
        { action: 'ask', class: 'write', pattern: /^write_/ },
        { action: 'deny', class: 'dangerous', pattern: /^delete_/ },
      ],
    });

    expect(service.evaluate({ sessionId: 's1', toolName: 'read_file' })).toMatchObject({
      action: 'allow',
      class: 'read',
    });

    expect(service.evaluate({ sessionId: 's1', toolName: 'delete_file' })).toMatchObject({
      action: 'deny',
      class: 'dangerous',
    });

    const askDecision = service.evaluate({
      sessionId: 's1',
      toolName: 'write_file',
      input: { filePath: 'chapter-01.md' },
    });

    expect(askDecision.action).toBe('ask');
    expect(service.getPending('s1')).toMatchObject({
      sessionId: 's1',
      name: 'write_file',
      input: { filePath: 'chapter-01.md' },
    });

    expect(service.resolvePending('s1', askDecision.pending.callId, true)).toMatchObject({
      approved: true,
      callId: askDecision.pending.callId,
    });
    expect(service.getPending('s1')).toBeUndefined();
  });

  it('lets workflow runtime register and resolve confirmations by session', async () => {
    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const runtime = createWorkflowRuntime();

    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
    });

    const pending = runtime.registerPendingConfirmation(session.id, 'write_file', { filePath: 'outline.md' });
    expect(runtime.getPendingConfirmation(session.id)).toMatchObject({
      sessionId: session.id,
      name: 'write_file',
      input: { filePath: 'outline.md' },
    });

    expect(runtime.resolveConfirmation(session.id, pending.callId, false)).toMatchObject({
      approved: false,
      callId: pending.callId,
    });
    expect(runtime.getPendingConfirmation(session.id)).toBeUndefined();
  });

  it('filters write tools in readonly sessions before model generation', async () => {
    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { registerBuiltinTools } = await import('../src/tool/builtin');
    registerBuiltinTools();

    const generate = vi.fn(async (_messages, _system, tools) => {
      expect(tools.map((tool: any) => tool.id)).toContain('read_file');
      expect(tools.map((tool: any) => tool.id)).not.toContain('write_file');
      expect(tools.map((tool: any) => tool.id)).not.toContain('chapter_write');
      return { content: 'readonly ok', finishReason: 'stop' };
    });

    const runtime = createWorkflowRuntime({ generate });
    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
      mode: 'readonly',
    } as any);

    await runtime.sendMessage({
      sessionId: session.id,
      content: 'Review this project.',
      abortSignal: new AbortController().signal,
    });

    expect(generate).toHaveBeenCalledOnce();
  });

  it('keeps review-safe diff tools but hides direct write tools in suggest sessions', async () => {
    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { registerBuiltinTools } = await import('../src/tool/builtin');
    registerBuiltinTools();

    const generate = vi.fn(async (_messages, system, tools) => {
      const toolIds = tools.map((tool: any) => tool.id);
      expect(toolIds).toContain('read_file');
      expect(toolIds).toContain('rewrite_passage');
      expect(toolIds).toContain('outline_update');
      expect(toolIds).not.toContain('write_file');
      expect(toolIds).not.toContain('chapter_write');
      expect(system).toContain('- rewrite_passage:');
      expect(system).not.toContain('- write_file:');
      expect(system).not.toContain('- chapter_write:');
      return { content: 'suggest policy ok', finishReason: 'stop' };
    });

    const runtime = createWorkflowRuntime({ generate });
    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
      mode: 'suggest',
    } as any);

    await runtime.sendMessage({
      sessionId: session.id,
      content: 'Suggest a change.',
      abortSignal: new AbortController().signal,
    });

    expect(generate).toHaveBeenCalledOnce();
  });

  it('blocks tool execution when an active skill allowed-tools list excludes the tool', async () => {
    const { assertToolAllowed } = await import('../src/runtime/toolPolicy');

    expect(() => assertToolAllowed({
      toolName: 'write_file',
      sessionMode: 'auto',
      activeSkillAllowedTools: ['read_file'],
    })).toThrow(/not allowed by active skill/i);

    expect(() => assertToolAllowed({
      toolName: 'read_file',
      sessionMode: 'auto',
      activeSkillAllowedTools: ['read_file'],
    })).not.toThrow();
  });
});
