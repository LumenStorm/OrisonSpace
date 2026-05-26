import path from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig } from '@orison/shared-contracts';

const { handle, safeStorage } = vi.hoisted(() => ({
  handle: vi.fn(),
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  ipcMain: { handle },
  safeStorage,
}));

import { _setModelConfigDirForTest, registerConfigIpc } from '../main/ipc/configIpc';
import { registerModelProviderIpc } from '../main/ipc/modelProviderIpc';

const ORIGINAL_FETCH = globalThis.fetch;
const TEST_MODEL_DIR = path.join(process.cwd(), 'test-tmp-model-provider');

const SAMPLE_CONFIG: ModelConfig = {
  keys: [
    {
      id: 'key_001',
      name: 'Main relay',
      apiKey: 'sk-from-disk',
      baseUrl: 'https://relay.example.com',
      models: [
        { id: 'gpt-4o-mini', alias: 'GPT 4o mini', capability: 'text', enabled: true },
      ],
    },
  ],
};

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
    _setModelConfigDirForTest(TEST_MODEL_DIR);
    if (existsSync(TEST_MODEL_DIR)) rmSync(TEST_MODEL_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    _setModelConfigDirForTest(null);
    if (existsSync(TEST_MODEL_DIR)) rmSync(TEST_MODEL_DIR, { recursive: true, force: true });
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
      { id: 'gpt-4o-mini', capability: 'text', alias: 'GPT-4o mini' },
      { id: 'gpt-image-1', capability: 'image', alias: 'GPT Image 1' },
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
      { id: 'claude-3-5-sonnet-latest', capability: 'text', alias: 'Claude 3-5-sonnet-latest' },
      { id: 'gemini-2.5-pro', capability: 'text', alias: 'Gemini 2.5-pro' },
      { id: 'gpt-4o', capability: 'text', alias: 'GPT-4o' },
    ]);
  });

  it('can list remote models using only keyId so apiKey stays in the main process', async () => {
    registerConfigIpc();
    const saveCall = handle.mock.calls.find(([channel]) => channel === 'config:save-model');
    await saveCall![1]({}, SAMPLE_CONFIG);
    handle.mockClear();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({
      data: [{ id: 'gpt-4o-mini' }],
    }));

    registerModelProviderIpc();
    const [, handler] = handle.mock.calls[0]!;

    await expect(handler({}, {
      keyId: 'key_001',
    })).resolves.toEqual([
      { id: 'gpt-4o-mini', capability: 'text', alias: 'GPT-4o mini' },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://relay.example.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer sk-from-disk' }),
      }),
    );
  });
});
