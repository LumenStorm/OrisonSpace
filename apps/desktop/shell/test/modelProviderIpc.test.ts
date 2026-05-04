import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handle } = vi.hoisted(() => ({
  handle: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: { handle },
}));

import { registerModelProviderIpc } from '../main/ipc/modelProviderIpc';

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
    vi.restoreAllMocks();
  });

  it('fetches OpenAI-compatible model lists from the desktop main process', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({
      data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-image-1' }],
    }));

    registerModelProviderIpc();

    expect(handle).toHaveBeenCalledWith('model:list-provider-models', expect.any(Function));

    const [, handler] = handle.mock.calls[0]!;
    await expect(handler({}, {
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://relay.example.com/v1',
    })).resolves.toEqual([
      { id: 'gpt-4o-mini', capabilities: ['text'] },
      { id: 'gpt-image-1', capabilities: ['image'] },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://relay.example.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    );
  });
});
