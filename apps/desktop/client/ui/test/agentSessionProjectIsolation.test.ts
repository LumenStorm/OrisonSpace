import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';

const apiMocks = vi.hoisted(() => ({
  createAgentSession: vi.fn(),
  fetchAgentSession: vi.fn(),
  setAgentSessionModel: vi.fn(async () => ({ ok: true })),
  setAgentSessionMode: vi.fn(async () => ({ ok: true })),
  deleteAgentSession: vi.fn(async () => true),
  listAgentSessions: vi.fn(),
  streamAgentMessage: vi.fn(() => ({ promise: Promise.resolve({ status: 'completed' }), cleanup: vi.fn() })),
}));

vi.mock('../src/shared/api/agent', () => apiMocks);

import { createAgentSessionSlice, type AgentSessionSlice } from '../src/shared/store/agentSessionSlice';

type TestState = AgentSessionSlice & {
  currentProject: { path?: string } | null;
  activeChapterId: string | null;
  pendingDiffs: any[];
  pendingToolConfirm: any;
  pendingPassageResolve: unknown | null;
  fieldMetadata: Record<string, { version: number } | undefined>;
  setPendingPatch: ReturnType<typeof vi.fn>;
};

const useTestStore = create<TestState>()((...args) => ({
  currentProject: null,
  activeChapterId: null,
  pendingDiffs: [],
  pendingToolConfirm: null,
  pendingPassageResolve: null,
  fieldMetadata: {},
  setPendingPatch: vi.fn(),
  ...createAgentSessionSlice(...args),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('agent session project isolation', () => {
  beforeEach(() => {
    apiMocks.createAgentSession.mockReset();
    apiMocks.fetchAgentSession.mockReset();
    apiMocks.listAgentSessions.mockReset();
    apiMocks.setAgentSessionModel.mockReset();
    apiMocks.setAgentSessionModel.mockResolvedValue({ ok: true });
    apiMocks.setAgentSessionMode.mockReset();
    apiMocks.setAgentSessionMode.mockResolvedValue({ ok: true });
    apiMocks.streamAgentMessage.mockClear();
    (globalThis.window as any) = globalThis.window ?? {};
    (window as any).orisonDesktop = { abortAgentRun: vi.fn() };
    useTestStore.setState({
      currentProject: null,
      agentSessionId: null,
      agentMessages: [],
      agentSessions: [],
      agentLoading: false,
      agentError: null,
      pendingDiffs: [],
      pendingToolConfirm: null,
    });
  });

  it('does not attach a session created for a project that has already changed', async () => {
    const created = deferred<any>();
    apiMocks.createAgentSession.mockReturnValue(created.promise);
    useTestStore.setState({ currentProject: { path: 'I:/project-a' } });

    const sending = useTestStore.getState().sendAgentMessage('hello');
    useTestStore.setState({ currentProject: { path: 'I:/project-b' } });
    useTestStore.getState().resetAgentForProjectSwitch();
    created.resolve({ id: 'session-a', messages: [] });
    await sending;

    expect(useTestStore.getState().agentSessionId).toBeNull();
    expect(useTestStore.getState().agentMessages).toEqual([]);
    expect(apiMocks.streamAgentMessage).not.toHaveBeenCalled();
  });

  it('prevents duplicate session creation while the first send is still creating a session', async () => {
    const created = deferred<any>();
    apiMocks.createAgentSession.mockReturnValue(created.promise);
    useTestStore.setState({ currentProject: { path: 'I:/project-a' } });

    const firstSend = useTestStore.getState().sendAgentMessage('first');
    const secondSend = useTestStore.getState().sendAgentMessage('second');

    expect(useTestStore.getState().agentLoading).toBe(true);
    expect(apiMocks.createAgentSession).toHaveBeenCalledTimes(1);

    created.resolve({ id: 'session-a', messages: [] });
    await Promise.all([firstSend, secondSend]);

    expect(apiMocks.streamAgentMessage).toHaveBeenCalledTimes(1);
  });

  it('keeps the session creation configuration stable until creation finishes', async () => {
    const created = deferred<any>();
    apiMocks.createAgentSession.mockReturnValue(created.promise);
    const originalModel = { keyId: 'key', modelId: 'model-a' };
    useTestStore.setState({
      currentProject: { path: 'I:/project-a' },
      agentMode: 'suggest',
      agentModelRef: originalModel,
    });

    const sending = useTestStore.getState().sendAgentMessage('hello');
    useTestStore.getState().setAgentMode('auto');
    useTestStore.getState().setAgentModelRef({ keyId: 'key', modelId: 'model-b' });

    expect(useTestStore.getState().agentMode).toBe('suggest');
    expect(useTestStore.getState().agentModelRef).toEqual(originalModel);

    created.resolve({ id: 'session-a', messages: [] });
    await sending;

    expect(apiMocks.createAgentSession).toHaveBeenCalledWith(
      'I:/project-a',
      'suggest',
      originalModel,
    );
  });

  it('keeps the latest project session list when older loads resolve later', async () => {
    const listA = deferred<any[]>();
    const listB = deferred<any[]>();
    apiMocks.listAgentSessions
      .mockImplementationOnce(() => listA.promise)
      .mockImplementationOnce(() => listB.promise);

    useTestStore.setState({ currentProject: { path: 'I:/project-a' } });
    const loadingA = useTestStore.getState().loadAgentSessions();
    useTestStore.setState({ currentProject: { path: 'I:/project-b' } });
    useTestStore.getState().resetAgentForProjectSwitch();
    const loadingB = useTestStore.getState().loadAgentSessions();

    listB.resolve([{ id: 'session-b', projectPath: 'I:/project-b' }]);
    await loadingB;
    listA.resolve([{ id: 'session-a', projectPath: 'I:/project-a' }]);
    await loadingA;

    expect(useTestStore.getState().agentSessions.map((session) => session.id)).toEqual(['session-b']);
  });

  it('clears the cached session list during a project reset', () => {
    useTestStore.setState({
      agentSessions: [{ id: 'session-a', projectPath: 'I:/project-a' } as any],
    });

    useTestStore.getState().resetAgentForProjectSwitch();

    expect(useTestStore.getState().agentSessions).toEqual([]);
  });

  it('rolls back the displayed permission mode when session persistence fails', async () => {
    apiMocks.setAgentSessionMode.mockResolvedValue({ ok: false });
    useTestStore.setState({
      currentProject: { path: 'I:/project-a' },
      agentSessionId: 'session-a',
      agentMode: 'suggest',
    });

    useTestStore.getState().setAgentMode('readonly');

    await vi.waitFor(() => {
      expect(useTestStore.getState().agentMode).toBe('suggest');
    });
    expect(useTestStore.getState().agentError).toBe('agent.modeSwitchFailed');
  });

  it('uses the persisted permission mode when switching sessions', async () => {
    apiMocks.fetchAgentSession.mockResolvedValue({
      id: 'session-auto',
      permissionMode: 'auto',
      messages: [],
    });
    useTestStore.setState({
      currentProject: { path: 'I:/project-a' },
      agentMode: 'readonly',
    });

    await useTestStore.getState().switchAgentSession('session-auto');

    expect(useTestStore.getState().agentMode).toBe('auto');
    expect(localStorage.getItem('orison_agentMode')).toBe('auto');
  });

  it('连续模式切换都失败时回滚到最后确认模式', async () => {
    const first = deferred<{ ok: boolean }>();
    const second = deferred<{ ok: boolean }>();
    apiMocks.setAgentSessionMode
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    useTestStore.setState({
      currentProject: { path: 'I:/project-a' },
      agentSessionId: 'session-a',
      agentMode: 'suggest',
    });

    useTestStore.getState().setAgentMode('readonly');
    useTestStore.getState().setAgentMode('auto');
    first.resolve({ ok: false });
    await vi.waitFor(() => expect(apiMocks.setAgentSessionMode).toHaveBeenCalledTimes(2));
    second.resolve({ ok: false });

    await vi.waitFor(() => expect(useTestStore.getState().agentMode).toBe('suggest'));
  });

  it('连续模型切换都失败时回滚到最后确认模型', async () => {
    const first = deferred<{ ok: boolean }>();
    const second = deferred<{ ok: boolean }>();
    apiMocks.setAgentSessionModel
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const confirmed = { keyId: 'key', modelId: 'model-a' };
    useTestStore.setState({
      currentProject: { path: 'I:/project-a' },
      agentSessionId: 'session-a',
      agentModelRef: confirmed,
    });

    useTestStore.getState().setAgentModelRef({ keyId: 'key', modelId: 'model-b' });
    useTestStore.getState().setAgentModelRef({ keyId: 'key', modelId: 'model-c' });
    first.resolve({ ok: false });
    await vi.waitFor(() => expect(apiMocks.setAgentSessionModel).toHaveBeenCalledTimes(2));
    second.resolve({ ok: false });

    await vi.waitFor(() => expect(useTestStore.getState().agentModelRef).toEqual(confirmed));
  });

  it('删除后端拒绝的历史会话时保留列表项', async () => {
    apiMocks.deleteAgentSession.mockResolvedValueOnce(false);
    useTestStore.setState({
      currentProject: { path: 'I:/project-a' },
      agentSessions: [{ id: 'session-a', projectPath: 'I:/project-a' } as any],
    });

    await useTestStore.getState().deleteAgentSession('session-a');

    expect(apiMocks.deleteAgentSession).toHaveBeenCalledWith('session-a', 'I:/project-a');
    expect(useTestStore.getState().agentSessions.map((session) => session.id)).toEqual(['session-a']);
  });
});
