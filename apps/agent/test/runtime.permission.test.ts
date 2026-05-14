import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('runtime permission service', () => {
  let projectPath = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-runtime-permission-'));
  });

  afterEach(() => {
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
});
