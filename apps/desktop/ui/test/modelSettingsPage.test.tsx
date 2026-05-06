import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig, ModelProfile } from '@orison/shared-contracts';
import { ModelSettingsPage } from '../src/shared/components/settings/ModelSettingsPage';
import { useAppStore } from '../src/shared/store/appStore';

const baseProfile: ModelProfile = {
  schemaVersion: 2,
  id: 'model_001',
  name: 'GPT-4o',
  provider: 'openai',
  apiKey: 'sk-test',
  baseUrl: 'https://api.openai.com',
  models: [
    {
      id: 'gpt-4o',
      alias: 'GPT-4o',
      apiFormat: 'openai-chat-completions',
      capabilities: ['text', 'image'],
    },
  ],
};

function buildConfig(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    profiles: overrides.profiles ?? [baseProfile],
    selected: {
      novel: { profileId: 'model_001', modelId: 'gpt-4o' },
      image: null,
      video: null,
      ...overrides.selected,
    },
  };
}

const tFake = (key: string) => key;

describe('ModelSettingsPage', () => {
  beforeEach(() => {
    useAppStore.setState({ outputEntries: [], appendOutputEntry: vi.fn() } as any);
    (window as any).orisonDesktop = {
      listProviderModels: vi.fn().mockResolvedValue([
        { id: 'gpt-4o', capabilities: ['text', 'image'] },
        { id: 'gpt-image-1', capabilities: ['image'] },
      ]),
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders empty state when no profiles exist', () => {
    const setModelConfig = vi.fn().mockResolvedValue(undefined);
    render(
      <ModelSettingsPage
        t={tFake}
        modelConfig={{ profiles: [], selected: { novel: null, image: null, video: null } }}
        setModelConfig={setModelConfig}
      />
    );
    expect(screen.getByText('settings.emptyTitle')).toBeTruthy();
    expect(screen.getByText('settings.emptyHint')).toBeTruthy();
  });

  it('shows usage chip on profile rows when assigned', () => {
    const setModelConfig = vi.fn().mockResolvedValue(undefined);
    render(<ModelSettingsPage t={tFake} modelConfig={buildConfig()} setModelConfig={setModelConfig} />);
    const rows = screen.getAllByRole('button', { pressed: false });
    const gpt4oRow = rows.find((row) => row.textContent?.includes('GPT-4o'));
    expect(gpt4oRow).toBeTruthy();
    expect(gpt4oRow?.textContent).toContain('settings.usedForNovel');
  });

  it('selecting profile and applying name change persists via setModelConfig', async () => {
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
    expect(arg.profiles[0].name).toBe('Renamed');
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
    expect(arg.profiles).toHaveLength(0);
    expect(arg.selected.novel).toBeNull();
  });

  it('changing assignment dropdown immediately persists', async () => {
    const setModelConfig = vi.fn().mockResolvedValue(undefined);
    render(
      <ModelSettingsPage
        t={tFake}
        modelConfig={buildConfig({
          profiles: [
            baseProfile,
            {
              schemaVersion: 2,
              id: 'model_002',
              name: 'Imagen-3',
              provider: 'gcp',
              apiKey: 'gcp-key',
              baseUrl: 'https://generativelanguage.googleapis.com',
              models: [
                {
                  id: 'imagen-3',
                  alias: 'Imagen 3',
                  apiFormat: 'gemini-images',
                  capabilities: ['image'],
                },
              ],
            },
          ],
          selected: { novel: { profileId: 'model_001', modelId: 'gpt-4o' }, image: null, video: null },
        })}
        setModelConfig={setModelConfig}
      />
    );

    const imageSelect = screen.getByRole('combobox', { name: /settings\.imageModel/i });
    await userEvent.selectOptions(imageSelect, 'model_002:imagen-3');

    await waitFor(() => expect(setModelConfig).toHaveBeenCalled());
    const arg = setModelConfig.mock.calls[0][0] as ModelConfig;
    expect(arg.selected.image).toEqual({ profileId: 'model_002', modelId: 'imagen-3' });
    expect(arg.selected.novel).toEqual({ profileId: 'model_001', modelId: 'gpt-4o' });
  });

  it('refresh failure surfaces banner with error message', async () => {
    (window as any).orisonDesktop.listProviderModels = vi
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
