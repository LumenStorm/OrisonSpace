import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageGenInspector } from '../src/features/inspector/ImageGenInspector';
import { useAppStore } from '../src/shared/store/appStore';
import { defaultParamsFor } from '../src/shared/imageGen/schema';

const baseProfile = {
  schemaVersion: 2 as const,
  id: 'model_001',
  name: 'Image Model',
  provider: 'openai' as const,
  apiKey: 'sk-test',
  baseUrl: 'https://api.openai.com',
  models: [
    {
      id: 'gpt-image-1',
      alias: 'GPT Image 1',
      apiFormat: 'openai-images' as const,
      capabilities: ['image' as const],
    },
  ],
};

const fallbackProfile = {
  schemaVersion: 2 as const,
  id: 'model_002',
  name: 'Legacy Image',
  provider: 'openai' as const,
  apiKey: 'sk-test',
  baseUrl: 'https://api.openai.com',
  models: [
    {
      id: 'dall-e-3',
      alias: 'DALL-E 3',
      apiFormat: 'openai-images' as const,
      capabilities: ['image' as const],
    },
  ],
};

const gptImage2Profile = {
  schemaVersion: 2 as const,
  id: 'model_003',
  name: 'GPT Image 2',
  provider: 'openai' as const,
  apiKey: 'sk-test',
  baseUrl: 'https://api.openai.com',
  models: [
    {
      id: 'gpt-image-2',
      alias: 'GPT Image 2',
      apiFormat: 'openai-images' as const,
      capabilities: ['image' as const],
    },
  ],
};

function seedStore(extra: Partial<ReturnType<typeof useAppStore.getState>> = {}) {
  useAppStore.setState({
    modelConfig: {
      profiles: [baseProfile, fallbackProfile],
      selected: { novel: null, image: { profileId: 'model_001', modelId: 'gpt-image-1' }, video: null },
    },
    imageGenFamily: 'gpt-image-1',
    imageGenParams: defaultParamsFor('gpt-image-1'),
    ...extra,
  } as any);
}

describe('ImageGenInspector', () => {
  beforeEach(() => {
    localStorage.clear();
    seedStore();
    (window as any).orisonDesktop = {
      saveModelConfig: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders gpt-image-1 specific fields (quality, background, output format, moderation)', () => {
    render(<ImageGenInspector />);

    const labelText = inspectorLabelText();
    // Tolerant to both raw-key (i18n not yet loaded) and translated forms.
    expect(labelText).toMatch(/imageGen\.params\.model|Model/);
    expect(labelText).toMatch(/imageGen\.params\.size|Size/);
    expect(labelText).toMatch(/imageGen\.params\.quality|Quality/);
    expect(labelText).toMatch(/imageGen\.params\.background|Background/);
    expect(labelText).toMatch(/imageGen\.params\.outputFormat|Output format/);
    expect(labelText).toMatch(/imageGen\.params\.moderation|Moderation/);
  });

  it('writes selected size + quality to the store', async () => {
    render(<ImageGenInspector />);

    const sizeSelect = findSelectByOption('1024x1536');
    await userEvent.selectOptions(sizeSelect, '1024x1536');

    expect(useAppStore.getState().imageGenParams.size).toBe('1024x1536');

    const qualitySelect = findSelectByOption('high', 'medium');
    await userEvent.selectOptions(qualitySelect, 'high');

    expect(useAppStore.getState().imageGenParams.quality).toBe('high');
  });

  it('switching to a non gpt-image-1 profile sanitizes params and hides gpt-image-1-only fields', async () => {
    // Pre-set gpt-image-1-only fields that must be dropped after the switch.
    useAppStore.setState({
      imageGenParams: {
        ...defaultParamsFor('gpt-image-1'),
        background: 'transparent',
        outputFormat: 'webp',
        outputCompression: 80,
        moderation: 'low',
      },
    } as any);

    render(<ImageGenInspector />);

    const profileSelect = screen.getAllByRole('combobox')[0];
    await userEvent.selectOptions(profileSelect, 'model_002:dall-e-3');

    const params = useAppStore.getState().imageGenParams;
    expect(useAppStore.getState().imageGenFamily).toBe('fallback');
    expect(params).not.toHaveProperty('background');
    expect(params).not.toHaveProperty('outputFormat');
    expect(params).not.toHaveProperty('outputCompression');
    expect(params).not.toHaveProperty('moderation');
    expect(params.size).toBe('1024x1024');
    expect(params.n).toBe(1);

    // gpt-image-1-only labels should no longer be rendered.
    const labelText = inspectorLabelText();
    expect(labelText).not.toMatch(/imageGen\.params\.background|Background/);
    expect(labelText).not.toMatch(/imageGen\.params\.outputFormat|Output format/);
    expect(labelText).not.toMatch(/imageGen\.params\.moderation|Moderation/);
  });

  it('compression slider only appears when output format is jpeg or webp', async () => {
    render(<ImageGenInspector />);

    function inspectorLabelTexts(): string[] {
      return Array.from(document.querySelectorAll('.inspector-label')).map(
        (el) => (el.textContent ?? '').trim(),
      );
    }
    function compressionLabelPresent(): boolean {
      return inspectorLabelTexts().some(
        (text) => text.includes('imageGen.params.outputCompression') || text.includes('Compression'),
      );
    }

    // Default outputFormat is png — slider must be hidden.
    expect(compressionLabelPresent()).toBe(false);

    // Switch to webp.
    const formatSelect = findSelectByOption('webp', 'jpeg');
    await userEvent.selectOptions(formatSelect, 'webp');

    // Sanity: state actually moved to webp.
    expect(useAppStore.getState().imageGenParams.outputFormat).toBe('webp');

    // Slider should now be visible (allow React + async i18n to settle).
    await waitFor(() => expect(compressionLabelPresent()).toBe(true));
  });

  it('persists params to localStorage with the orison_ prefix', async () => {
    render(<ImageGenInspector />);

    const sizeSelect = findSelectByOption('1024x1536');
    await userEvent.selectOptions(sizeSelect, '1024x1536');

    // Storage write is debounced — wait a tick beyond the 200ms window.
    await new Promise((resolve) => setTimeout(resolve, 260));

    const stored = localStorage.getItem('orison_imageGenParams');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toMatchObject({
      version: 2,
      family: 'gpt-image-1',
      customSize: false,
      params: expect.objectContaining({ size: '1024x1536' }),
    });
  });

  // Regression: the placeholder must be context-appropriate. The original
  // implementation reused `settings.modelSelectPlaceholder` ("fetch models
  // first") which made no sense on the image-gen page. Three states matter:
  //   1) no profiles at all          → "no models configured yet, add in Settings"
  //   2) profiles exist, none image  → "no image-capable model in the library"
  //   3) profiles include image      → "select an image model"
  describe('placeholder by state', () => {
    it('says "no profiles yet" when modelConfig is empty', () => {
      useAppStore.setState({
        modelConfig: { profiles: [], selected: { novel: null, image: null, video: null } },
      } as any);

      render(<ImageGenInspector />);

      const profileSelect = screen.getAllByRole('combobox')[0];
      const placeholderOption = profileSelect.querySelector('option[value=""]');
      expect(placeholderOption?.textContent ?? '').toMatch(
        /imageGen\.params\.noProfilesYet|No models configured yet/,
      );
    });

    it('says "no image-capable model" when profiles exist but none has image capability', () => {
      useAppStore.setState({
        modelConfig: {
          profiles: [
            {
              schemaVersion: 2 as const,
              id: 'novel_only',
              name: 'Novel Model',
              provider: 'openai',
              apiKey: 'sk-test',
              baseUrl: 'https://api.openai.com',
              models: [
                {
                  id: 'gpt-4',
                  alias: 'GPT 4',
                  apiFormat: 'openai-chat-completions' as const,
                  capabilities: ['text'],
                },
              ],
            },
          ],
          selected: { novel: { profileId: 'novel_only', modelId: 'gpt-4' }, image: null, video: null },
        },
      } as any);

      render(<ImageGenInspector />);

      const profileSelect = screen.getAllByRole('combobox')[0];
      const placeholderOption = profileSelect.querySelector('option[value=""]');
      expect(placeholderOption?.textContent ?? '').toMatch(
        /imageGen\.params\.noImageProfile|No image-capable model/,
      );
      // Crucially, NOT the legacy "fetch models first" or "Add model" copy —
      // those have settings-page semantics that don't belong here.
      expect(placeholderOption?.textContent ?? '').not.toMatch(
        /Fetch models first|请先获取模型列表|Add model|添加模型/,
      );
    });

    it('says "select an image model" when image-capable profiles exist', () => {
      // Default seedStore() already provides two image-capable profiles.
      useAppStore.setState({
        modelConfig: {
          profiles: [baseProfile, fallbackProfile],
          selected: { novel: null, image: null, video: null },
        },
      } as any);

      render(<ImageGenInspector />);

      const profileSelect = screen.getAllByRole('combobox')[0];
      const placeholderOption = profileSelect.querySelector('option[value=""]');
      expect(placeholderOption?.textContent ?? '').toMatch(
        /imageGen\.params\.selectModel|Select an image model/,
      );
    });
  });

  describe('gpt-image-2 family', () => {
    function seedGptImage2(extra: Partial<ReturnType<typeof useAppStore.getState>> = {}) {
      useAppStore.setState({
        modelConfig: {
          profiles: [gptImage2Profile, baseProfile, fallbackProfile],
          selected: {
            novel: null,
            image: { profileId: gptImage2Profile.id, modelId: 'gpt-image-2' },
            video: null,
          },
        },
        imageGenFamily: 'gpt-image-2',
        imageGenParams: defaultParamsFor('gpt-image-2'),
        imageGenCustomSize: false,
        ...extra,
      } as any);
    }

    it('background dropdown does not list "transparent" (gpt-image-2 rejects it)', () => {
      seedGptImage2();
      render(<ImageGenInspector />);

      const backgroundSelect = findSelectByOption('opaque', 'auto');
      const optionValues = Array.from(backgroundSelect.querySelectorAll('option')).map(
        (o) => (o as HTMLOptionElement).value,
      );
      expect(optionValues).toContain('auto');
      expect(optionValues).toContain('opaque');
      expect(optionValues).not.toContain('transparent');
    });

    it('size dropdown surfaces curated presets and a "custom..." option', () => {
      seedGptImage2();
      render(<ImageGenInspector />);

      // Size has both 'auto' (which other selects also have) AND '1280x720' —
      // that combo is unique to gpt-image-2 size.
      const sizeSelect = findSelectByOption('1280x720', '2048x2048');
      const optionValues = Array.from(sizeSelect.querySelectorAll('option')).map(
        (o) => (o as HTMLOptionElement).value,
      );
      expect(optionValues).toEqual(
        expect.arrayContaining([
          'auto',
          '1024x1024',
          '1024x1536',
          '1536x1024',
          '1280x720',
          '720x1280',
          '2048x2048',
          '4096x4096',
          'custom',
        ]),
      );
    });

    it('selecting "custom..." enables imageGenCustomSize and reveals W/H inputs', async () => {
      seedGptImage2();
      render(<ImageGenInspector />);

      const sizeSelect = findSelectByOption('1280x720', '2048x2048');
      await userEvent.selectOptions(sizeSelect, 'custom');

      expect(useAppStore.getState().imageGenCustomSize).toBe(true);
      expect(screen.getByLabelText(/imageGen\.params\.customWidth|Width/)).toBeTruthy();
      expect(screen.getByLabelText(/imageGen\.params\.customHeight|Height/)).toBeTruthy();
    });

    it('typing valid W/H formats size as "WxH" and clears custom mode on preset re-select', async () => {
      seedGptImage2();
      render(<ImageGenInspector />);

      const sizeSelect = findSelectByOption('1280x720', '2048x2048');
      await userEvent.selectOptions(sizeSelect, 'custom');

      const widthInput = screen.getByLabelText(/imageGen\.params\.customWidth|Width/) as HTMLInputElement;
      const heightInput = screen.getByLabelText(/imageGen\.params\.customHeight|Height/) as HTMLInputElement;

      // Use fireEvent.change for paste-style atomic value updates. userEvent.type
      // appends character-by-character, which interacts badly with controlled
      // inputs whose state setter clamps invalid intermediate values to 1.
      fireEvent.change(widthInput, { target: { value: '1600' } });
      fireEvent.change(heightInput, { target: { value: '912' } });

      // After both edits, size should be "1600x912" (last value wins).
      expect(useAppStore.getState().imageGenParams.size).toBe('1600x912');
      expect(useAppStore.getState().imageGenCustomSize).toBe(true);

      // Picking a preset switches back to dropdown mode.
      await userEvent.selectOptions(sizeSelect, '1024x1024');
      expect(useAppStore.getState().imageGenCustomSize).toBe(false);
      expect(useAppStore.getState().imageGenParams.size).toBe('1024x1024');
    });

    it('shows the validation hint and switches to error styling for invalid dimensions', async () => {
      seedGptImage2({
        imageGenCustomSize: true,
        imageGenParams: { ...defaultParamsFor('gpt-image-2'), size: '1080x720' },
      });

      render(<ImageGenInspector />);

      // 1080 is not a multiple of 16 — hint should be in invalid state.
      const hint = document.querySelector('.image-gen-custom-size-hint');
      expect(hint).toBeTruthy();
      expect(hint?.classList.contains('is-invalid')).toBe(true);
      const text = hint?.textContent ?? '';
      // Either the i18n key or the human text should mention the multiple-of-16 issue.
      expect(text).toMatch(/imageGen\.params\.customError\.notMultipleOf16|multiples of 16/i);
    });

    it('switching from gpt-image-1 (transparent) → gpt-image-2 sanitizes background to auto', async () => {
      // Start on gpt-image-1 with transparent.
      useAppStore.setState({
        modelConfig: {
          profiles: [gptImage2Profile, baseProfile],
          selected: {
            novel: null,
            image: { profileId: baseProfile.id, modelId: 'gpt-image-1' },
            video: null,
          },
        },
        imageGenFamily: 'gpt-image-1',
        imageGenParams: { ...defaultParamsFor('gpt-image-1'), background: 'transparent' },
        imageGenCustomSize: false,
      } as any);

      render(<ImageGenInspector />);

      const profileSelect = screen.getAllByRole('combobox')[0];
      await userEvent.selectOptions(profileSelect, `${gptImage2Profile.id}:gpt-image-2`);

      const params = useAppStore.getState().imageGenParams;
      expect(useAppStore.getState().imageGenFamily).toBe('gpt-image-2');
      expect(params.background).toBe('auto');
    });
  });
});

/**
 * Find a <select> element that contains all of the given option values. Useful
 * when multiple selects share the same default-selected value (e.g. "auto" is
 * shared by size / background / moderation).
 */
function findSelectByOption(...requiredValues: string[]): HTMLSelectElement {
  const match = screen.getAllByRole('combobox').find((el) => {
    const optionValues = Array.from(el.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);
    return requiredValues.every((value) => optionValues.includes(value));
  });
  if (!match) {
    throw new Error(`No <select> found with options: ${requiredValues.join(', ')}`);
  }
  return match as HTMLSelectElement;
}

/** Concatenated text content of every `.inspector-label` div in the document. */
function inspectorLabelText(): string {
  return Array.from(document.querySelectorAll('.inspector-label'))
    .map((el) => (el.textContent ?? '').trim())
    .join(' | ');
}
