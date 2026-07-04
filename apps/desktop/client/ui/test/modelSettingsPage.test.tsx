import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiKeyEntry, ModelConfig } from '@orison/shared-contracts';
import { ModelSettingsPage } from '../src/features/model-settings/ModelSettingsPage';
import { useAppStore } from '../src/shared/store/appStore';

const baseKey: ApiKeyEntry = {
  id: 'key_001',
  name: 'GPT-4o',
  protocol: 'openai-compatible',
  baseUrl: 'https://api.openai.com',
  apiKey: 'sk-test',
  models: [
    {
      id: 'gpt-4o',
      alias: 'GPT-4o Omni',
      capability: 'text',
      enabled: true,
    },
  ],
};

function buildConfig(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    keys: overrides.keys ?? [baseKey],
  };
}

const tFake = (key: string) => key;

describe('ModelSettingsPage', () => {
  beforeEach(() => {
    useAppStore.setState({ outputEntries: [], appendOutputEntry: vi.fn() } as any);
    (window as any).orisonDesktop = {
      listRemoteModels: vi.fn().mockResolvedValue([
        { id: 'gpt-4o', capability: 'text', alias: 'GPT-4o Omni' },
        { id: 'gpt-image-1', capability: 'image', alias: 'GPT Image 1' },
      ]),
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders empty state when no keys exist', () => {
    const setModelConfig = vi.fn().mockResolvedValue(undefined);
    render(
      <ModelSettingsPage t={tFake} modelConfig={{ keys: [] }} setModelConfig={setModelConfig} />
    );
    expect(screen.getByText('settings.emptyTitle')).toBeTruthy();
    expect(screen.getByText('settings.emptyHint')).toBeTruthy();
  });

  it('opens the profile editor from the empty state add action', async () => {
    const setModelConfig = vi.fn().mockResolvedValue(undefined);
    render(
      <ModelSettingsPage t={tFake} modelConfig={{ keys: [] }} setModelConfig={setModelConfig} />
    );

    await userEvent.click(screen.getByRole('button', { name: 'settings.emptyAction' }));

    expect(screen.getByLabelText('settings.profileName')).toBeInTheDocument();
    expect(screen.getByLabelText('settings.modelProtocol')).toBeInTheDocument();
    expect(screen.getByLabelText('settings.baseUrl')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument();
  });

  it('shows the no-selection state when keys exist but none is being edited', () => {
    const setModelConfig = vi.fn().mockResolvedValue(undefined);
    render(<ModelSettingsPage t={tFake} modelConfig={buildConfig()} setModelConfig={setModelConfig} />);

    expect(screen.getByText('settings.selectProfileHint')).toBeInTheDocument();
  });

  it('shows enabled-model summary and count on key rows', () => {
    const setModelConfig = vi.fn().mockResolvedValue(undefined);
    render(<ModelSettingsPage t={tFake} modelConfig={buildConfig()} setModelConfig={setModelConfig} />);
    const row = screen.getByRole('button', { pressed: false, name: /GPT-4o/ });
    expect(row.textContent).toContain('GPT-4o Omni');
    expect(row.textContent).toContain('1');
  });

  it('selecting a key and applying a name change persists via setModelConfig', async () => {
    const setModelConfig = vi.fn().mockResolvedValue(undefined);
    render(<ModelSettingsPage t={tFake} modelConfig={buildConfig()} setModelConfig={setModelConfig} />);
    const row = screen.getByRole('button', { pressed: false, name: /GPT-4o/ });
    await userEvent.click(row);

    const nameInput = screen.getByLabelText('settings.profileName');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Renamed');

    const applyButton = screen.getByRole('button', { name: 'settings.applyChanges' });
    expect(applyButton.hasAttribute('disabled')).toBe(false);
    await userEvent.click(applyButton);

    await waitFor(() => expect(setModelConfig).toHaveBeenCalled());
    const arg = setModelConfig.mock.calls[0][0] as ModelConfig;
    expect(arg.keys[0].name).toBe('Renamed');
  });

  it('opens delete confirm dialog and persists deletion on confirm', async () => {
    const setModelConfig = vi.fn().mockResolvedValue(undefined);
    render(<ModelSettingsPage t={tFake} modelConfig={buildConfig()} setModelConfig={setModelConfig} />);
    await userEvent.click(screen.getByRole('button', { pressed: false, name: /GPT-4o/ }));

    await userEvent.click(screen.getByRole('button', { name: 'settings.deleteModel' }));

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('settings.deleteConfirmTitle')).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('button', { name: 'settings.deleteConfirmAction' }));

    await waitFor(() => expect(setModelConfig).toHaveBeenCalled());
    const arg = setModelConfig.mock.calls[0][0] as ModelConfig;
    expect(arg.keys).toHaveLength(0);
  });

  it('refreshing models merges discovered entries into the draft', async () => {
    const setModelConfig = vi.fn().mockResolvedValue(undefined);
    render(<ModelSettingsPage t={tFake} modelConfig={buildConfig()} setModelConfig={setModelConfig} />);
    await userEvent.click(screen.getByRole('button', { pressed: false, name: /GPT-4o/ }));

    await userEvent.click(screen.getByRole('button', { name: 'settings.refreshModels' }));

    await waitFor(() => {
      expect((window as any).orisonDesktop.listRemoteModels).toHaveBeenCalled();
      // The newly discovered image model is added to the editor's model list.
      expect(screen.getByText('gpt-image-1')).toBeInTheDocument();
    });
  });

  it('refreshing a new anthropic-compatible key forwards the selected protocol', async () => {
    const setModelConfig = vi.fn().mockResolvedValue(undefined);
    render(
      <ModelSettingsPage t={tFake} modelConfig={{ keys: [] }} setModelConfig={setModelConfig} />
    );

    await userEvent.click(screen.getByRole('button', { name: 'settings.emptyAction' }));
    await userEvent.selectOptions(screen.getByLabelText('settings.modelProtocol'), 'anthropic-compatible');
    await userEvent.type(screen.getByLabelText('settings.baseUrl'), 'https://api.anthropic.com');
    await userEvent.type(screen.getByLabelText('settings.apiKey'), 'sk-ant-test');

    await userEvent.click(screen.getByRole('button', { name: 'settings.refreshModels' }));

    await waitFor(() => {
      expect((window as any).orisonDesktop.listRemoteModels).toHaveBeenCalledWith({
        protocol: 'anthropic-compatible',
        apiKey: 'sk-ant-test',
        baseUrl: 'https://api.anthropic.com',
      });
    });
  });

  it('refresh failure surfaces banner with error message', async () => {
    (window as any).orisonDesktop.listRemoteModels = vi
      .fn()
      .mockRejectedValue(new Error('Network down'));
    const setModelConfig = vi.fn().mockResolvedValue(undefined);
    render(<ModelSettingsPage t={tFake} modelConfig={buildConfig()} setModelConfig={setModelConfig} />);
    await userEvent.click(screen.getByRole('button', { pressed: false, name: /GPT-4o/ }));

    await userEvent.click(screen.getByRole('button', { name: 'settings.refreshModels' }));

    await waitFor(() => {
      const banner = screen.getByRole('alert');
      expect(banner.textContent).toContain('Network down');
    });
  });

  it('cancelling delete dialog leaves config unchanged', async () => {
    const setModelConfig = vi.fn().mockResolvedValue(undefined);
    render(<ModelSettingsPage t={tFake} modelConfig={buildConfig()} setModelConfig={setModelConfig} />);
    await userEvent.click(screen.getByRole('button', { pressed: false, name: /GPT-4o/ }));
    await userEvent.click(screen.getByRole('button', { name: 'settings.deleteModel' }));

    const dialog = screen.getByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'projects.cancel' }));

    expect(setModelConfig).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
