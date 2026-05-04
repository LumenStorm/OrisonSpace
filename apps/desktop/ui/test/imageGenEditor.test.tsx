import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageGenEditor } from '../src/features/editor/ImageGenEditor';
import { useAppStore } from '../src/shared/store/appStore';
import { defaultParamsFor } from '../src/shared/imageGen/schema';

describe('ImageGenEditor', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      token: 'token-1',
      currentProject: {
        projectId: '00001',
        name: 'Image Project',
        path: 'C:\\Users\\LightYuki\\Documents\\OrisonSpace\\ImageProject',
        type: 'novel',
      },
      modelConfig: {
        profiles: [
          {
            id: 'model_001',
            name: 'Image Model',
            provider: 'openai',
            apiKey: 'sk-test',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-image-1',
            capabilities: ['image'],
          },
        ],
        selected: {
          novel: null,
          image: 'model_001',
          video: null,
        },
      },
      creativeFields: {},
      // Editor reads params from the slice — seed with explicit values so the
      // outgoing request body is predictable.
      imageGenFamily: 'gpt-image-1',
      imageGenParams: {
        ...defaultParamsFor('gpt-image-1'),
        size: '1792x1024' /* unused for gpt-image-1, will be sanitized to 'auto' */,
      },
    } as any);

    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: 'openai',
        model: 'gpt-image-1',
        images: [{ base64: 'abc123', mimeType: 'image/png' }],
      }),
    });

    (window as any).orisonDesktop = {
      saveBase64Image: vi.fn().mockResolvedValue({
        relativePath: 'temp/images/test.png',
        fullPath: 'C:\\Users\\LightYuki\\Documents\\OrisonSpace\\ImageProject\\temp\\images\\test.png',
        fileName: 'test.png',
      }),
      moveProjectFile: vi.fn().mockResolvedValue('C:\\Users\\LightYuki\\Documents\\OrisonSpace\\ImageProject\\assets\\images\\test.png'),
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('reads parameters from the store and posts gpt-image-1 fields without response_format', async () => {
    // Inject a fully-specified parameter set as if the Inspector had set it.
    useAppStore.setState({
      imageGenFamily: 'gpt-image-1',
      imageGenParams: {
        size: '1024x1536',
        n: 2,
        quality: 'high',
        background: 'transparent',
        outputFormat: 'webp',
        outputCompression: 80,
        moderation: 'low',
        user: 'user-xyz',
      },
    } as any);

    render(<ImageGenEditor />);

    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe the image you want to generate/), 'quiet desk');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));

    await waitFor(() => expect(window.orisonDesktop.saveBase64Image).toHaveBeenCalled());

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = (fetch as any).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: 'gpt-image-1',
      prompt: 'quiet desk',
      size: '1024x1536',
      n: 2,
      quality: 'high',
      background: 'transparent',
      outputFormat: 'webp',
      outputCompression: 80,
      moderation: 'low',
      user: 'user-xyz',
    });
    expect(body).not.toHaveProperty('response_format');
    expect(screen.getByAltText('quiet desk')).toBeTruthy();
  });

  it('moves the temporary image to assets when saving', async () => {
    render(<ImageGenEditor />);

    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe the image you want to generate/), 'quiet desk');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));

    const saveButton = await screen.findByRole('button', { name: /imageGen.saveToFile|Save File/ });
    await userEvent.click(saveButton);

    expect(window.orisonDesktop.moveProjectFile).toHaveBeenCalledWith(
      'C:\\Users\\LightYuki\\Documents\\OrisonSpace\\ImageProject',
      'temp/images/test.png',
      'assets/images/test.png',
    );
  });

  it('renders the model profile chip but no parameter controls', () => {
    render(<ImageGenEditor />);

    // The chip surfaces the selected profile.
    expect(screen.getByText(/Image Model/)).toBeTruthy();
    expect(screen.getByText(/gpt-image-1/)).toBeTruthy();

    // Size / count selectors must NOT appear in the editor anymore — they live
    // in the Inspector now.
    expect(screen.queryByDisplayValue('1024x1024')).toBeNull();
    expect(screen.queryByDisplayValue('1024x1536')).toBeNull();
  });

  // Regression: when the bottom panel is already open AND the active tab is
  // already "properties", clicking an "open parameters" button is a no-op and
  // feels broken. The button must not render in that state at all.
  it('hides the open-parameters button when inspector is already visible', () => {
    useAppStore.setState({ bottomPanelOpen: true, activeBottomTab: 'properties' } as any);

    render(<ImageGenEditor />);

    expect(screen.queryByRole('button', { name: /imageGen\.openParameters|Open parameters/i })).toBeNull();
  });

  it('shows the open-parameters button when bottom panel is collapsed', async () => {
    useAppStore.setState({ bottomPanelOpen: false, activeBottomTab: 'properties' } as any);

    render(<ImageGenEditor />);

    const button = screen.getByRole('button', { name: /imageGen\.openParameters|Open parameters/i });
    expect(button).toBeTruthy();

    await userEvent.click(button);
    expect(useAppStore.getState().bottomPanelOpen).toBe(true);
    expect(useAppStore.getState().activeBottomTab).toBe('properties');
  });

  it('shows the open-parameters button when bottom panel is on a different tab', async () => {
    useAppStore.setState({ bottomPanelOpen: true, activeBottomTab: 'output' } as any);

    render(<ImageGenEditor />);

    const button = screen.getByRole('button', { name: /imageGen\.openParameters|Open parameters/i });
    await userEvent.click(button);

    expect(useAppStore.getState().bottomPanelOpen).toBe(true);
    expect(useAppStore.getState().activeBottomTab).toBe('properties');
  });
});
