import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { existsSync, rmSync } from 'node:fs';
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
import { registerModelGatewayIpc } from '../main/ipc/modelGatewayIpc';

const TEST_MODEL_DIR = path.join(process.cwd(), 'test-tmp-model-gateway');
const ORIGINAL_FETCH = globalThis.fetch;

const SAMPLE_CONFIG: ModelConfig = {
  profiles: [
    {
      schemaVersion: 2,
      id: 'profile_text',
      name: 'Text',
      provider: 'openai',
      apiKey: 'sk-text',
      baseUrl: 'https://relay.example.com/v1',
      models: [
        {
          id: 'gpt-4o-mini',
          alias: 'GPT 4o mini',
          apiFormat: 'openai-chat-completions',
          capabilities: ['text'],
        },
        {
          id: 'dall-e-3',
          alias: 'DALL-E 3',
          apiFormat: 'openai-images',
          capabilities: ['image'],
        },
        {
          id: 'sora-1',
          alias: 'Sora 1',
          apiFormat: 'sora-videos',
          capabilities: ['video'],
        },
      ],
    },
  ],
  selected: {
    novel: { profileId: 'profile_text', modelId: 'gpt-4o-mini' },
    image: { profileId: 'profile_text', modelId: 'dall-e-3' },
    video: { profileId: 'profile_text', modelId: 'sora-1' },
  },
};

async function seedConfig() {
  registerConfigIpc();
  const saveCall = handle.mock.calls.find(([channel]) => channel === 'config:save-model');
  await saveCall![1]({}, SAMPLE_CONFIG);
}

function pickHandler(channel: string) {
  const call = handle.mock.calls.find(([c]) => c === channel);
  if (!call) throw new Error(`handler not registered: ${channel}`);
  return call[1] as (event: unknown, payload: unknown) => Promise<unknown>;
}

describe('model gateway IPC', () => {
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

  it('generate-text dispatches via openai-chat-completions and forwards Authorization with apiKey', async () => {
    await seedConfig();
    registerModelGatewayIpc();

    const responseBody = JSON.stringify({
      choices: [{ message: { content: 'hello world' } }],
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => JSON.parse(responseBody),
      text: async () => responseBody,
    } as unknown as Response));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const handler = pickHandler('model:generate-text');
    const result = (await handler({}, {
      slot: { profileId: 'profile_text', modelId: 'gpt-4o-mini' },
      request: {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
      },
    })) as { provider: string; text: string };

    expect(result).toMatchObject({ provider: 'openai', text: 'hello world' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(callArgs[0]).toBe('https://relay.example.com/v1/chat/completions');
    const init = callArgs[1];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-text');
  });

  it('does not leak apiKey in the IPC return value', async () => {
    await seedConfig();
    registerModelGatewayIpc();

    const body = JSON.stringify({ choices: [{ message: { content: 'ok' } }] });
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => JSON.parse(body),
      text: async () => body,
    } as unknown as Response)) as unknown as typeof globalThis.fetch;

    const handler = pickHandler('model:generate-text');
    const result = await handler({}, {
      slot: { profileId: 'profile_text', modelId: 'gpt-4o-mini' },
      request: { model: 'x', messages: [{ role: 'user', content: 'hi' }] },
    });
    expect(JSON.stringify(result)).not.toContain('sk-text');
  });

  it('rejects when the slot points to a non-existent profile', async () => {
    await seedConfig();
    registerModelGatewayIpc();

    globalThis.fetch = vi.fn(async () => {
      throw new Error('should not be called');
    }) as unknown as typeof globalThis.fetch;

    const handler = pickHandler('model:generate-text');
    await expect(
      handler({}, {
        slot: { profileId: 'unknown', modelId: 'gpt-4o-mini' },
        request: { model: 'x', messages: [{ role: 'user', content: 'hi' }] },
      }),
    ).rejects.toThrow();
  });

  it('rejects video generation against sora-videos placeholder without making a network call', async () => {
    await seedConfig();
    registerModelGatewayIpc();

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const handler = pickHandler('model:generate-video');
    await expect(
      handler({}, {
        slot: { profileId: 'profile_text', modelId: 'sora-1' },
        request: { model: 'sora-1', prompt: 'hello' },
      }),
    ).rejects.toThrow(/not implemented|video/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when capability does not match (e.g. image-format model used for text)', async () => {
    await seedConfig();
    registerModelGatewayIpc();

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const handler = pickHandler('model:generate-text');
    await expect(
      handler({}, {
        slot: { profileId: 'profile_text', modelId: 'dall-e-3' },
        request: { model: 'dall-e-3', messages: [{ role: 'user', content: 'hi' }] },
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
