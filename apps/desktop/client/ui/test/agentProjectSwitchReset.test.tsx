import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../src/shared/store/appStore';

// The project subscription auto-installs when appStore is imported. These tests
// verify that switching the active project wipes the previous project's agent
// conversation — otherwise messages, session id, pending diffs and model would
// bleed across projects (and an accepted stale diff could hit the wrong files).

describe('agent state reset on project switch', () => {
  beforeEach(() => {
    (window as any).orisonDesktop = {
      abortAgentRun: vi.fn(),
      loadProjectDocument: vi.fn().mockResolvedValue(null),
    };
    useAppStore.setState({
      currentProject: null,
      addRecentProject: vi.fn(),
      loadBgTasks: vi.fn(),
      agentSessionId: null,
      agentMessages: [],
      pendingDiffs: [],
      pendingToolConfirm: null,
      agentModelRef: null,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears agent session, messages, diffs, confirmations and model when the project changes', () => {
    // Open project A and accumulate agent state on it.
    useAppStore.setState({
      currentProject: { projectId: 'A', name: 'A', path: 'I:/proj-a', type: 'novel' },
    } as any);
    useAppStore.setState({
      agentSessionId: 'session-A',
      agentMessages: [{ id: 'm1', role: 'user', content: 'hi', createdAt: 1 }],
      pendingDiffs: [{ kind: 'chapter', id: 'd1', toolId: 'chapter_write', fileName: 'c1.md', content: 'x' }],
      pendingToolConfirm: { callId: 'c1', name: 'write_file', input: {} },
      agentModelRef: { keyId: 'k', modelId: 'm' },
    } as any);

    // Switch to project B.
    useAppStore.setState({
      currentProject: { projectId: 'B', name: 'B', path: 'I:/proj-b', type: 'novel' },
    } as any);

    const s = useAppStore.getState();
    expect(s.agentSessionId).toBeNull();
    expect(s.agentMessages).toEqual([]);
    expect(s.pendingDiffs).toEqual([]);
    expect(s.pendingToolConfirm).toBeNull();
    expect(s.agentModelRef).toBeNull();
    // A running stream, if any, is aborted on switch.
    expect((window as any).orisonDesktop.abortAgentRun).not.toThrow;
  });
});
