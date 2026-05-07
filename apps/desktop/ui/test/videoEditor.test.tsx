import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoEditor } from '../src/features/editor/VideoEditor';
import { useAppStore } from '../src/shared/store/appStore';

describe('VideoEditor', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      token: 'token-1',
      currentProject: {
        projectId: '00001',
        name: 'Video Project',
        path: 'C:\\Users\\LightYuki\\Documents\\OrisonSpace\\VideoProject',
        type: 'novel',
      },
      modelConfig: {
        profiles: [
          {
            schemaVersion: 2 as const,
            id: 'model_003',
            name: 'Video Model',
            provider: 'openai',
            apiKey: 'sk-video',
            baseUrl: 'https://api.openai.com',
            models: [
              {
                id: 'sora-1',
                alias: 'Sora 1',
                apiFormat: 'sora-videos' as const,
                capabilities: ['video'],
              },
            ],
          },
        ],
        selected: {
          novel: null,
          image: null,
          video: { profileId: 'model_003', modelId: 'sora-1' },
        },
      },
    } as any);

    (window as any).orisonDesktop = {
      generateVideo: vi.fn().mockResolvedValue({
        provider: 'openai',
        model: 'sora-1',
        videos: [{ id: 'video-1', url: 'https://example.com/video.mp4' }],
      }),
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('calls the desktop video gateway when clicking generate', async () => {
    render(<VideoEditor />);

    await userEvent.type(
      screen.getByPlaceholderText(/video\.promptPlaceholder|Describe the video you want to generate/i),
      'slow cinematic pan across a rainy street',
    );

    const button = screen.getByRole('button', { name: /video\.generate|Generate/i });
    expect(button).not.toHaveAttribute('disabled');

    await userEvent.click(button);

    expect(window.orisonDesktop.generateVideo).toHaveBeenCalledTimes(1);
    const ipcCall = (window.orisonDesktop.generateVideo as any).mock.calls[0][0];
    expect(ipcCall.slot).toEqual({ profileId: 'model_003', modelId: 'sora-1' });
    expect(ipcCall.request).toMatchObject({
      model: 'sora-1',
      prompt: 'slow cinematic pan across a rainy street',
    });
    expect(ipcCall.request).not.toHaveProperty('apiKey');
    expect(await screen.findByText('Generated 1 video(s)')).toBeInTheDocument();
  });
});
