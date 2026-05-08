import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { handle } = vi.hoisted(() => ({
  handle: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: { handle },
}));

import { registerModelProviderIpc } from '../main/ipc/modelProviderIpc';

const ORIGINAL_FETCH = globalThis.fetch;

function mockJsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('model provider IPC', () => {
  beforeEach(() => {
    handle.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.restoreAllMocks();
  });

  it('fetches model list from /v1/models with Bearer auth', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({
      data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-image-1' }],
    }));

    registerModelProviderIpc();

    expect(handle).toHaveBeenCalledWith('model:list-remote-models', expect.any(Function));

    const [, handler] = handle.mock.calls[0]!;
    await expect(handler({}, {
      apiKey: 'sk-test',
      baseUrl: 'https://relay.example.com',
    })).resolves.toEqual([
      { id: 'gpt-4o-mini', capability: 'text', alias: 'GPT-4o' },
      { id: 'gpt-image-1', capability: 'image', alias: 'GPT Image' },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://relay.example.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer sk-test' }),
      }),
    );
  });

  it('lists cross-vendor ids through a relay with correct capability inference', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({
      data: [
        { id: 'claude-3-5-sonnet-latest' },
        { id: 'gemini-2.5-pro' },
        { id: 'gpt-4o' },
      ],
    }));

    registerModelProviderIpc();
    const [, handler] = handle.mock.calls[0]!;

    await expect(handler({}, {
      apiKey: 'sk-relay',
      baseUrl: 'https://newapi.example.com',
    })).resolves.toEqual([
      { id: 'claude-3-5-sonnet-latest', capability: 'text', alias: 'Claude' },
      { id: 'gemini-2.5-pro', capability: 'text', alias: 'Gemini' },
      { id: 'gpt-4o', capability: 'text', alias: 'GPT-4o' },
    ]);
  });
});
