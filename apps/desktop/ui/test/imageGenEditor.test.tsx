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
            schemaVersion: 2 as const,
            id: 'model_001',
            name: 'Image Model',
            provider: 'openai',
            apiKey: 'sk-test',
            baseUrl: 'https://api.openai.com',
            models: [
              {
                id: 'gpt-image-1',
                alias: 'GPT Image 1',
                apiFormat: 'openai-images' as const,
                capabilities: ['image'],
              },
            ],
          },
        ],
        selected: {
          novel: null,
          image: { profileId: 'model_001', modelId: 'gpt-image-1' },
          video: null,
        },
      },
      creativeFields: {},
      imageGenFamily: 'gpt-image-1',
      imageGenParams: {
        ...defaultParamsFor('gpt-image-1'),
        size: '1792x1024',
      },
    } as any);

    (window as any).orisonDesktop = {
      saveBase64Image: vi.fn().mockResolvedValue({
        relativePath: 'temp/images/test.png',
        fullPath: 'C:\\Users\\LightYuki\\Documents\\OrisonSpace\\ImageProject\\temp\\images\\test.png',
        fileName: 'test.png',
      }),
      moveProjectFile: vi.fn().mockResolvedValue('C:\\Users\\LightYuki\\Documents\\OrisonSpace\\ImageProject\\assets\\images\\test.png'),
      generateImage: vi.fn().mockResolvedValue({
        provider: 'openai',
        model: 'gpt-image-1',
        images: [
          {
            b64Json: 'abc123',
            mimeType: 'image/png',
            dataUrl: 'data:image/png;base64,abc123',
          },
        ],
      }),
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('reads parameters from the store and posts gpt-image-1 fields without response_format', async () => {
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

    expect(window.orisonDesktop.generateImage).toHaveBeenCalledTimes(1);
    const ipcCall = (window.orisonDesktop.generateImage as any).mock.calls[0][0];
    expect(ipcCall.slot).toEqual({ profileId: 'model_001', modelId: 'gpt-image-1' });
    expect(ipcCall.request).toMatchObject({
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
    expect(ipcCall.request).not.toHaveProperty('apiKey');
    expect(ipcCall.request).not.toHaveProperty('response_format');
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

    // The chip surfaces the selected profile via {provider} · {alias}
    expect(screen.getByText(/openai/i)).toBeTruthy();
    expect(screen.getByText(/GPT Image 1/i)).toBeTruthy();

    // Size / count selectors must NOT appear in the editor anymore.
    expect(screen.queryByDisplayValue('1024x1024')).toBeNull();
    expect(screen.queryByDisplayValue('1024x1536')).toBeNull();
  });

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
