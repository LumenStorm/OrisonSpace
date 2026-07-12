import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig } from '@orison/shared-contracts';

// Mock the IPC boundary only. The slice action under test (setAgentModelRef)
// runs for real against this mock, so we exercise the genuine UI behavior:
// persist → await { ok } → roll back + surface error on failure.
const setAgentSessionModel = vi.fn();
vi.mock('../src/shared/api/agent', async () => {
  const actual = await vi.importActual<typeof import('../src/shared/api/agent')>(
    '../src/shared/api/agent',
  );
  return { ...actual, setAgentSessionModel: (...args: unknown[]) => setAgentSessionModel(...args) };
});

import { AgentInput } from '../src/features/agent-panel/AgentInput';
import { useAppStore } from '../src/shared/store/appStore';

const modelConfig: ModelConfig = {
  keys: [
    {
      id: 'key_001',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com',
      apiKey: 'sk-test',
      models: [
        { id: 'gpt-4o', alias: 'GPT-4o', capability: 'text', enabled: true },
        { id: 'gpt-4o-mini', alias: 'GPT-4o mini', capability: 'text', enabled: true },
      ],
    },
  ],
};

function seedStore(overrides: Record<string, unknown> = {}) {
  useAppStore.getState().resetAgentForProjectSwitch();
  // Set the project first so the auto-installed project subscription fires its
  // agent-reset on THIS change; then seed the agent fields in a second update
  // (same project ref → subscription is a no-op and won't wipe agentSessionId).
  useAppStore.setState({
    currentProject: { projectId: 'p1', name: 'Cold City', path: 'I:/echo/project', type: 'novel' },
  } as any);
  useAppStore.setState({
    resolvedLocale: 'en-US',
    modelConfig,
    agentSessionId: 'session-1',
    agentModelRef: { keyId: 'key_001', modelId: 'gpt-4o' },
    agentLoading: false,
    agentError: null,
    chapters: [],
    openFiles: [],
    pendingAttachments: [],
    pendingToolConfirm: null,
    pendingPassageResolve: null,
    ...overrides,
  } as any);
}

function modelSelect(): HTMLSelectElement {
  // The model dropdown is the <select> whose accessible title is "Select model".
  return screen.getByTitle('Select model') as HTMLSelectElement;
}

describe('AgentInput model switching (UI behavior)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAgentSessionModel.mockReset();
    // The project subscription may abort a prior run on reset; stub the bridge.
    (window as any).orisonDesktop = { abortAgentRun: vi.fn() };
  });

  afterEach(() => {
    cleanup();
  });

  it('persists the switch through the IPC boundary and keeps the new selection on success', async () => {
    setAgentSessionModel.mockResolvedValue({ ok: true });
    seedStore();
    render(<AgentInput />);

    await userEvent.selectOptions(modelSelect(), 'key_001:gpt-4o-mini');

    await waitFor(() => {
      expect(setAgentSessionModel).toHaveBeenCalledWith(
        'session-1',
        'I:/echo/project',
        { keyId: 'key_001', modelId: 'gpt-4o-mini' },
      );
    });
    // Selection sticks; no error surfaced.
    expect(useAppStore.getState().agentModelRef).toEqual({ keyId: 'key_001', modelId: 'gpt-4o-mini' });
    expect(useAppStore.getState().agentError).toBeNull();
    expect(modelSelect().value).toBe('key_001:gpt-4o-mini');
  });

  it('rolls the dropdown back and surfaces an error when the runtime refuses the switch', async () => {
    setAgentSessionModel.mockResolvedValue({ ok: false });
    seedStore();
    render(<AgentInput />);

    await userEvent.selectOptions(modelSelect(), 'key_001:gpt-4o-mini');

    // On refusal the store rolls back to the previous model and sets agentError,
    // so the UI never shows a model the session isn't actually using.
    await waitFor(() => {
      expect(useAppStore.getState().agentModelRef).toEqual({ keyId: 'key_001', modelId: 'gpt-4o' });
    });
    expect(useAppStore.getState().agentError).toBe('agent.modelSwitchFailed');
    expect(modelSelect().value).toBe('key_001:gpt-4o');
  });

  it('allows switching while a turn is running (queued for next turn)', async () => {
    setAgentSessionModel.mockResolvedValue({ ok: true });
    seedStore({ agentLoading: true });
    render(<AgentInput />);

    // The dropdown is no longer disabled mid-run; the switch still persists
    // (the runtime queues it as pendingModelRef for the next turn).
    expect(modelSelect()).not.toBeDisabled();
    await userEvent.selectOptions(modelSelect(), 'key_001:gpt-4o-mini');

    await waitFor(() => {
      expect(setAgentSessionModel).toHaveBeenCalledWith(
        'session-1',
        'I:/echo/project',
        { keyId: 'key_001', modelId: 'gpt-4o-mini' },
      );
    });
  });
});
