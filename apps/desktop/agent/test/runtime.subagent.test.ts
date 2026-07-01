import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPermissionService } from '../src/runtime/permission';

describe('runtime subagent dispatch', () => {
  let projectPath = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-runtime-subagent-'));
  });

  afterEach(async () => {
    const { closeDb } = await import('../src/agent/persistence');
    closeDb(projectPath);
    rmSync(projectPath, { recursive: true, force: true });
    vi.resetModules();
  });

  it('starts a child session with narrowed permissions and bubbles result to parent', async () => {
    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { createSubagentRuntime } = await import('../src/runtime/subagent');

    const parentPermission = createPermissionService({
      rules: [
        { action: 'allow', class: 'read', pattern: /^read_/ },
        { action: 'ask', class: 'write', pattern: /^write_/ },
      ],
    });

    const runtime = createWorkflowRuntime({
      permission: parentPermission,
    });

    const parent = runtime.createSession({
      agentName: 'creative-director',
      projectPath,
    });

    const subagents = createSubagentRuntime({
      runtime,
      narrowPermission: () => createPermissionService({
        rules: [
          { action: 'allow', class: 'read', pattern: /^read_/ },
          { action: 'deny', class: 'dangerous', pattern: /^write_/ },
        ],
      }),
    });

    const dispatched = await subagents.dispatch({
      parentSessionId: parent.id,
      role: 'outline-expander',
      prompt: 'Expand this outline into scene beats.',
      complete: async () => ({
        content: 'Expanded into 12 scene beats.',
      }),
    });

    expect(dispatched.session.parentId).toBe(parent.id);
    expect(dispatched.session.sessionRole).toBe('child');
    expect(runtime.getSession(parent.id)?.children).toContain(dispatched.session.id);

    expect(dispatched.permission.evaluate({
      sessionId: dispatched.session.id,
      toolName: 'read_file',
    })).toMatchObject({
      action: 'allow',
      class: 'read',
    });

    expect(dispatched.permission.evaluate({
      sessionId: dispatched.session.id,
      toolName: 'write_file',
    })).toMatchObject({
      action: 'deny',
      class: 'dangerous',
    });

    expect(dispatched.result).toMatchObject({
      childSessionId: dispatched.session.id,
      role: 'outline-expander',
      content: 'Expanded into 12 scene beats.',
      status: 'completed',
    });
  });
});
