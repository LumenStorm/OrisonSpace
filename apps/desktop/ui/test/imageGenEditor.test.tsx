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
      selectedImageRef: { keyId: 'model_001', modelId: 'gpt-image-1' },
      modelConfig: {
        keys: [
          {
            id: 'model_001',
            name: 'Image Model',
            baseUrl: 'https://api.openai.com',
            apiKey: 'sk-test',
            models: [
              {
                id: 'gpt-image-1',
                alias: 'GPT Image 1',
                capability: 'image' as const,
                enabled: true,
              },
            ],
          },
        ],
      },
      creativeFields: {},
      assetArchiveTarget: null,
      imageGenPrompt: '',
      imageGenResultsMeta: [],
      imageGenFamily: 'gpt-image-1',
      imageGenParams: {
        ...defaultParamsFor('gpt-image-1'),
        size: '1792x1024',
      },
    } as any);

    (window as any).orisonDesktop = {
      saveBase64Image: vi.fn().mockResolvedValue({
        relativePath: 'temp/images/generation/test.png',
        fullPath: 'C:\\Users\\LightYuki\\Documents\\OrisonSpace\\ImageProject\\temp\\images\\generation\\test.png',
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
      readDirectory: vi.fn().mockResolvedValue([]),
      readFileBinary: vi.fn(),
      deleteProjectFile: vi.fn().mockResolvedValue(true),
      upsertTask: vi.fn().mockResolvedValue(undefined),
      listTasks: vi.fn().mockResolvedValue([]),
      deleteTask: vi.fn().mockResolvedValue(undefined),
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
    expect(ipcCall.ref).toEqual({ keyId: 'model_001', modelId: 'gpt-image-1' });
    expect(ipcCall.request).toMatchObject({
      model: 'gpt-image-1',
      prompt: 'quiet desk',
      size: '1024x1536',
      n: 2,
      quality: 'high',
      background: 'transparent',
      outputFormat: 'webp',
    });
    expect(ipcCall.request).not.toHaveProperty('apiKey');
    expect(ipcCall.request).not.toHaveProperty('response_format');
    expect(screen.getByAltText('quiet desk')).toBeTruthy();
  });

  it('moves the generated image to assets when adding it to assets', async () => {
    render(<ImageGenEditor />);

    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe the image you want to generate/), 'quiet desk');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));

    const addButton = await screen.findByRole('button', { name: /imageGen.addToAssets|Add to Assets/ });
    await userEvent.click(addButton);

    expect(window.orisonDesktop.moveProjectFile).toHaveBeenCalledWith(
      'C:\\Users\\LightYuki\\Documents\\OrisonSpace\\ImageProject',
      'temp/images/generation/test.png',
      'assets/images/test.png',
    );
  });

  it('attaches the generated image to the targeted archive instead of creating an image card', async () => {
    useAppStore.setState({
      creativeFields: {
        asset_cards: [
          {
            id: 'char_lin_qi',
            type: 'character',
            name: '林七',
            summary: '冷静克制的调查员',
            tags: ['主角'],
            relationships: [],
            sourceRefs: ['assets/characters/lin-qi.yaml'],
            status: 'active',
            archive: {
              path: 'assets/characters/lin-qi.yaml',
              slug: 'lin-qi',
              schemaVersion: 1,
            },
            visuals: {
              primaryImage: '',
              gallery: [],
            },
            details: {
              profile: {
                role: '主角',
              },
            },
          },
        ],
      },
      assetArchiveTarget: {
        assetId: 'char_lin_qi',
        mode: 'gallery',
      },
    } as any);

    render(<ImageGenEditor />);

    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe the image you want to generate/), 'quiet desk');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));

    const addButton = await screen.findByRole('button', { name: /imageGen.addToAssets|Add to Assets/ });
    await userEvent.click(addButton);

    const cards = (useAppStore.getState().creativeFields.asset_cards as any[]) ?? [];
    expect(cards).toHaveLength(1);
    expect(cards[0].type).toBe('character');
    expect(cards[0].visuals.gallery).toHaveLength(1);
    expect(cards[0].visuals.gallery[0].path).toBe('assets/images/test.png');
    expect(cards.find((card) => card.type === 'image')).toBeUndefined();
  });

  it('loads existing generation images from temp/images/generation', async () => {
    (window.orisonDesktop.readDirectory as any).mockResolvedValue([
      {
        name: 'temp',
        path: '/temp',
        isDir: true,
        children: [
          {
            name: 'images',
            path: '/temp/images',
            isDir: true,
            children: [
              {
                name: 'generation',
                path: '/temp/images/generation',
                isDir: true,
                children: [
                  {
                    name: 'loaded.png',
                    path: '/temp/images/generation/loaded.png',
                    isDir: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
    (window.orisonDesktop.readFileBinary as any).mockResolvedValue({
      base64: 'loaded123',
      mimeType: 'image/png',
    });

    render(<ImageGenEditor />);

    await waitFor(() => expect(window.orisonDesktop.readFileBinary).toHaveBeenCalledWith(
      'C:\\Users\\LightYuki\\Documents\\OrisonSpace\\ImageProject\\temp\\images\\generation\\loaded.png',
    ));
    expect(screen.getByAltText('loaded.png')).toBeTruthy();
  });

  it('renders the model profile chip', () => {
    render(<ImageGenEditor />);

    // The chip surfaces the selected profile via {provider} · {alias}.
    expect(screen.getByText(/Image Model/i)).toBeTruthy();
    expect(screen.getByText(/GPT Image 1/i)).toBeTruthy();

    // Size / count selectors must NOT appear in the editor anymore — they
    // live exclusively in the BottomPanel properties tab.
    expect(screen.queryByDisplayValue('1024x1024')).toBeNull();
    expect(screen.queryByDisplayValue('1024x1536')).toBeNull();
    // The "Open parameters" entry point was removed — no lingering button.
    expect(screen.queryByRole('button', { name: /open parameters/i })).toBeNull();
  });

  it('copies prompt to clipboard from the gallery card', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<ImageGenEditor />);

    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe the image you want to generate/), 'quiet desk');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));

    await waitFor(() => expect(screen.getByAltText('quiet desk')).toBeTruthy());

    const copyButton = screen.getAllByRole('button', { name: /imageGen.copyPrompt|Copy prompt/ })[0];
    await userEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith('quiet desk');
  });

  it('deletes a generated image via the delete button', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    (window.orisonDesktop.deleteProjectFile as any).mockResolvedValue(true);

    render(<ImageGenEditor />);

    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe the image you want to generate/), 'quiet desk');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));

    await waitFor(() => expect(screen.getByAltText('quiet desk')).toBeTruthy());

    const deleteButton = screen.getByRole('button', { name: /imageGen.delete|Delete/ });
    await userEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() =>
      expect(window.orisonDesktop.deleteProjectFile).toHaveBeenCalledWith(
        'C:\\Users\\LightYuki\\Documents\\OrisonSpace\\ImageProject',
        'temp/images/generation/test.png',
      ),
    );
    await waitFor(() => expect(screen.queryByAltText('quiet desk')).toBeNull());
  });

  it('disables delete for an image that was added to assets', async () => {
    render(<ImageGenEditor />);

    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe the image you want to generate/), 'quiet desk');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));

    const addButton = await screen.findByRole('button', { name: /imageGen.addToAssets|Add to Assets/ });
    await userEvent.click(addButton);

    await waitFor(() => {
      const deleteButton = screen.getByRole('button', { name: /imageGen.cannotDeleteAsset|already added/i });
      expect(deleteButton.getAttribute('disabled')).not.toBeNull();
    });
  });
});
