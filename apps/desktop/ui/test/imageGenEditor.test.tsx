import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageGenEditor } from '../src/features/editor/ImageGenEditor';
import { useAppStore } from '../src/shared/store/appStore';

describe('ImageGenEditor', () => {
  beforeEach(() => {
    useAppStore.setState({
      token: 'token-1',
      currentProject: {
        projectId: '00001',
        name: 'Image Project',
        path: 'C:\\Users\\LightYuki\\Documents\\OrisonSpace\\ImageProject',
        type: 'novel',
      },
      modelConfig: {
        models: {
          novel: { provider: 'openai', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
          image: { provider: 'openai', apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1', model: 'gpt-image-1' },
          video: { provider: 'openai', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'placeholder-video' },
        },
      },
      creativeFields: {},
    } as any);

    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: 'openai',
        model: 'gpt-image-1',
        images: [{ b64Json: 'abc123', mimeType: 'image/png', dataUrl: 'data:image/png;base64,abc123' }],
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

  it('generates images, writes temporary project files, and renders previews', async () => {
    render(<ImageGenEditor />);

    await userEvent.type(screen.getByPlaceholderText('imageGen.promptPlaceholder'), 'quiet desk');
    await userEvent.selectOptions(screen.getByDisplayValue('1024x1024'), '1792x1024');
    await userEvent.selectOptions(screen.getByDisplayValue('1'), '1');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate/ }));

    await waitFor(() => expect(window.orisonDesktop.saveBase64Image).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/v1/generation/openai/image',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"size":"1792x1024"'),
      }),
    );
    expect(screen.getByAltText('quiet desk')).toBeTruthy();
  });

  it('moves the temporary image to assets when saving', async () => {
    render(<ImageGenEditor />);

    await userEvent.type(screen.getByPlaceholderText('imageGen.promptPlaceholder'), 'quiet desk');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate/ }));

    const saveButton = await screen.findByRole('button', { name: 'imageGen.saveToFile' });
    await userEvent.click(saveButton);

    expect(window.orisonDesktop.moveProjectFile).toHaveBeenCalledWith(
      'C:\\Users\\LightYuki\\Documents\\OrisonSpace\\ImageProject',
      'temp/images/test.png',
      'assets/images/test.png',
    );
  });
});
