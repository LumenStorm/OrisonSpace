import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageGenEditor } from '../src/features/editor/ImageGenEditor';
import { useAppStore } from '../src/shared/store/appStore';
import { useConfirmStore } from '../src/shared/store/confirmStore';
import { defaultParamsFor } from '../src/shared/imageGen/schema';

const TEST_PROJECT_DIR = join(tmpdir(), 'OrisonSpace', 'ImageProject');
const TEST_PROJECT_DIR_POSIX = TEST_PROJECT_DIR.replace(/\\/g, '/');

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

// `src/shared/api/filesystem.ts` binds `const api = window.orisonDesktop` at
// module-load time. In the test environment the preload bridge isn't installed
// before modules evaluate, so that capture would be `undefined`. Mock the module
// to forward to `window.orisonDesktop` at call-time, mirroring the real wrapper's
// thin pass-through (incl. its `?? []` / `?? null` defaults) so the
// "called with these args" assertions stay meaningful.
vi.mock('../src/shared/api/filesystem', () => ({
  readDirectory: (...args: any[]) =>
    (window as any).orisonDesktop?.readDirectory(...args) ?? Promise.resolve([]),
  readFileBinary: (...args: any[]) =>
    (window as any).orisonDesktop?.readFileBinary(...args) ?? Promise.resolve(null),
  saveBase64Image: (...args: any[]) => (window as any).orisonDesktop.saveBase64Image(...args),
  moveProjectFile: (...args: any[]) => (window as any).orisonDesktop.moveProjectFile(...args),
  deleteProjectFile: (...args: any[]) => (window as any).orisonDesktop.deleteProjectFile(...args),
}));

vi.mock('../src/features/editor/ImageEditDialog', () => ({
  ImageEditDialog: ({ onSave }: { onSave: (payload: any) => Promise<void> }) => (
    <div role="dialog">
      <button type="button" onClick={() => void onSave({ b64Json: 'edited-b64', mimeType: 'image/png', intent: 'save' })}>save edit</button>
      <button type="button" onClick={() => void onSave({ b64Json: 'variant-input', mimeType: 'image/png', intent: 'generate' })}>generate variant</button>
    </div>
  ),
}));

describe('ImageGenEditor', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      token: 'token-1',
      currentProject: {
        projectId: '00001',
        name: 'Image Project',
        path: TEST_PROJECT_DIR,
        type: 'novel',
      },
      modelConfig: {
        keys: [
          {
            id: 'model_001',
            name: 'Image Model',
            apiKey: 'sk-test',
            baseUrl: 'https://api.openai.com',
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
      selectedImageRef: { keyId: 'model_001', modelId: 'gpt-image-1' },
      creativeFields: {},
      imageGenPrompt: '',
      imageGenFamily: 'gpt-image-1',
      imageGenParams: {
        ...defaultParamsFor('gpt-image-1'),
        size: '1792x1024',
      },
    } as any);

    (window as any).orisonDesktop = {
      saveBase64Image: vi.fn().mockResolvedValue({
        relativePath: 'temp/images/generation/test.png',
        fullPath: `${TEST_PROJECT_DIR}\\temp\\images\\generation\\test.png`,
        fileName: 'test.png',
      }),
      moveProjectFile: vi.fn().mockResolvedValue(`${TEST_PROJECT_DIR}\\assets\\images\\test.png`),
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
      upsertTask: vi.fn(),
      deleteTask: vi.fn(),
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

  it('does not write a completed generation into a newly opened project', async () => {
    const deferred = createDeferred<{
      provider: string;
      model: string;
      images: Array<{ b64Json: string; mimeType: string; dataUrl: string }>;
    }>();
    (window.orisonDesktop.generateImage as any).mockReturnValue(deferred.promise);

    render(<ImageGenEditor />);

    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe the image you want to generate/), 'project A image');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));
    await waitFor(() => expect(window.orisonDesktop.generateImage).toHaveBeenCalledTimes(1));

    const projectBResult = {
      id: 'project-b-result',
      prompt: 'project B image',
      tempRelativePath: 'temp/images/generation/project-b.png',
      mimeType: 'image/png',
      assetAdded: false,
      source: 'loaded' as const,
    };
    useAppStore.setState({
      currentProject: {
        projectId: '00002',
        name: 'Project B',
        path: `${TEST_PROJECT_DIR}-B`,
        type: 'novel',
      },
    } as any);
    useAppStore.setState({ imageGenResultsMeta: [projectBResult] } as any);

    deferred.resolve({
      provider: 'openai',
      model: 'gpt-image-1',
      images: [{
        b64Json: 'project-a-base64',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,project-a-base64',
      }],
    });

    await waitFor(() => expect(window.orisonDesktop.saveBase64Image).toHaveBeenCalledTimes(1));
    expect(window.orisonDesktop.saveBase64Image).toHaveBeenCalledWith(
      TEST_PROJECT_DIR,
      expect.objectContaining({ b64Json: 'project-a-base64' }),
    );
    expect(useAppStore.getState().imageGenResultsMeta).toEqual([projectBResult]);
    expect(screen.queryByAltText('project A image')).toBeNull();
  });

  it('does not save provider results after the background task is cancelled', async () => {
    const deferred = createDeferred<{
      provider: string;
      model: string;
      images: Array<{ b64Json: string; mimeType: string; dataUrl: string }>;
    }>();
    (window.orisonDesktop.generateImage as any).mockReturnValue(deferred.promise);

    render(<ImageGenEditor />);

    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe the image you want to generate/), 'cancelled image');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));
    await waitFor(() => expect(window.orisonDesktop.generateImage).toHaveBeenCalledTimes(1));

    const taskId = useAppStore.getState().bgTasks.find((task) => task.status === 'running')?.id;
    expect(taskId).toBeTruthy();
    useAppStore.getState().cancelBgTask(taskId!);

    deferred.resolve({
      provider: 'openai',
      model: 'gpt-image-1',
      images: [{
        b64Json: 'cancelled-base64',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,cancelled-base64',
      }],
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }).getAttribute('disabled')).toBeNull();
    });
    expect(window.orisonDesktop.saveBase64Image).not.toHaveBeenCalled();
    expect(screen.queryByAltText('cancelled image')).toBeNull();
  });

  it('removes an image that finishes saving after cancellation', async () => {
    const saving = createDeferred<{
      relativePath: string;
      fullPath: string;
      fileName: string;
    }>();
    (window.orisonDesktop.saveBase64Image as any).mockReturnValue(saving.promise);

    render(<ImageGenEditor />);

    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe the image you want to generate/), 'cancel during save');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));
    await waitFor(() => expect(window.orisonDesktop.saveBase64Image).toHaveBeenCalledTimes(1));

    const taskId = useAppStore.getState().bgTasks.find((task) => task.status === 'running')?.id;
    expect(taskId).toBeTruthy();
    useAppStore.getState().cancelBgTask(taskId!);
    saving.resolve({
      relativePath: 'temp/images/generation/cancelled.png',
      fullPath: `${TEST_PROJECT_DIR}\\temp\\images\\generation\\cancelled.png`,
      fileName: 'cancelled.png',
    });

    await waitFor(() => {
      expect(window.orisonDesktop.deleteProjectFile).toHaveBeenCalledWith(
        TEST_PROJECT_DIR,
        'temp/images/generation/cancelled.png',
      );
    });
    expect(screen.queryByAltText('cancel during save')).toBeNull();
  });

  it('moves the generated image to assets when adding it to assets', async () => {
    render(<ImageGenEditor />);

    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe the image you want to generate/), 'quiet desk');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));

    const addButton = await screen.findByRole('button', { name: /imageGen.addToAssets|Add to Assets/ });
    await userEvent.click(addButton);

    expect(window.orisonDesktop.moveProjectFile).toHaveBeenCalledWith(
      TEST_PROJECT_DIR,
      'temp/images/generation/test.png',
      'assets/images/test.png',
    );
  });

  it('does not add an asset card to a newly opened project after promotion finishes', async () => {
    const moving = createDeferred<string>();
    (window.orisonDesktop.moveProjectFile as any).mockReturnValue(moving.promise);
    render(<ImageGenEditor />);
    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe/), 'project A asset');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));
    await userEvent.click(await screen.findByRole('button', { name: /imageGen.addToAssets|Add to Assets/ }));
    useAppStore.setState({
      currentProject: { projectId: '00002', name: 'Project B', path: `${TEST_PROJECT_DIR}-B`, type: 'novel' },
      creativeFields: { asset_cards: [] },
    } as any);
    moving.resolve(`${TEST_PROJECT_DIR}\\assets\\images\\test.png`);
    await waitFor(() => expect(window.orisonDesktop.moveProjectFile).toHaveBeenCalled());
    expect(useAppStore.getState().creativeFields.asset_cards ?? []).toEqual([]);
  });

  it('does not show an edited image in a newly opened project after save finishes', async () => {
    const saving = createDeferred<{ relativePath: string; fullPath: string; fileName: string }>();
    render(<ImageGenEditor />);
    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe/), 'project A edit');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));
    await userEvent.click(await screen.findByRole('button', { name: /imageGen.edit|Edit/ }));
    (window.orisonDesktop.saveBase64Image as any).mockReturnValueOnce(saving.promise);
    await userEvent.click(screen.getByRole('button', { name: 'save edit' }));
    useAppStore.setState({ currentProject: { projectId: '00002', name: 'Project B', path: `${TEST_PROJECT_DIR}-B`, type: 'novel' } } as any);
    saving.resolve({ relativePath: 'temp/images/generation/edited.png', fullPath: `${TEST_PROJECT_DIR}\\edited.png`, fileName: 'edited.png' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByAltText('project A edit edited')).toBeNull();
  });

  it('does not show a generated variant in a newly opened project', async () => {
    const generating = createDeferred<any>();
    render(<ImageGenEditor />);
    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe/), 'project A variant');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));
    await userEvent.click(await screen.findByRole('button', { name: /imageGen.edit|Edit/ }));
    (window.orisonDesktop.generateImage as any).mockReturnValueOnce(generating.promise);
    await userEvent.click(screen.getByRole('button', { name: 'generate variant' }));
    useAppStore.setState({ currentProject: { projectId: '00002', name: 'Project B', path: `${TEST_PROJECT_DIR}-B`, type: 'novel' } } as any);
    generating.resolve({ provider: 'openai', model: 'gpt-image-1', images: [{ b64Json: 'variant-b64', mimeType: 'image/png' }] });
    await waitFor(() => expect(window.orisonDesktop.saveBase64Image).toHaveBeenCalledTimes(2));
    expect(screen.queryByAltText('project A variant')).toBeNull();
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

    // joinProjectPath 统一输出正斜杠路径（跨平台安全，主进程再按平台归一化）。
    await waitFor(() => expect(window.orisonDesktop.readFileBinary).toHaveBeenCalledWith(
      `${TEST_PROJECT_DIR_POSIX}/temp/images/generation/loaded.png`,
    ));
    expect(screen.getByAltText('loaded.png')).toBeTruthy();
  });

  it('renders the model profile chip', () => {
    render(<ImageGenEditor />);

    // The chip surfaces the selected key via {key.name} · {entry.alias}.
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
    const requestConfirm = vi.fn().mockResolvedValue(true);
    useConfirmStore.setState({ requestConfirm } as any);
    (window.orisonDesktop.deleteProjectFile as any).mockResolvedValue(true);

    render(<ImageGenEditor />);

    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe the image you want to generate/), 'quiet desk');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));

    await waitFor(() => expect(screen.getByAltText('quiet desk')).toBeTruthy());

    const deleteButton = screen.getByRole('button', { name: /imageGen.delete|Delete/ });
    await userEvent.click(deleteButton);

    expect(requestConfirm).toHaveBeenCalled();
    await waitFor(() =>
      expect(window.orisonDesktop.deleteProjectFile).toHaveBeenCalledWith(
        TEST_PROJECT_DIR,
        'temp/images/generation/test.png',
      ),
    );
    await waitFor(() => expect(screen.queryByAltText('quiet desk')).toBeNull());
  });

  it('does not delete from a newly opened project after delayed confirmation', async () => {
    const confirming = createDeferred<boolean>();
    useConfirmStore.setState({ requestConfirm: vi.fn().mockReturnValue(confirming.promise) } as any);
    render(<ImageGenEditor />);
    await userEvent.type(screen.getByPlaceholderText(/imageGen.promptPlaceholder|Describe/), 'project A delete');
    await userEvent.click(screen.getByRole('button', { name: /imageGen.generate|Generate Image/ }));
    await userEvent.click(await screen.findByRole('button', { name: /imageGen.delete|Delete/ }));
    useAppStore.setState({ currentProject: { projectId: '00002', name: 'Project B', path: `${TEST_PROJECT_DIR}-B`, type: 'novel' } } as any);
    confirming.resolve(true);
    await waitFor(() => expect(window.orisonDesktop.deleteProjectFile).toHaveBeenCalledWith(TEST_PROJECT_DIR, 'temp/images/generation/test.png'));
    expect(window.orisonDesktop.deleteProjectFile).not.toHaveBeenCalledWith(`${TEST_PROJECT_DIR}-B`, expect.anything());
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
