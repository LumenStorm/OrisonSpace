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
import { registerStorySyncIpc } from '../main/ipc/storySyncIpc';

const TEST_MODEL_DIR = path.join(process.cwd(), 'test-tmp-story-sync-bridge');
const ORIGINAL_FETCH = globalThis.fetch;

const SAMPLE_CONFIG: ModelConfig = {
  keys: [
    {
      id: 'key_text',
      name: 'Text',
      protocol: 'openai-compatible',
      apiKey: 'sk-text',
      baseUrl: 'https://relay.example.com',
      models: [
        { id: 'gpt-4o-mini', alias: 'GPT 4o mini', capability: 'text', enabled: true },
      ],
    },
  ],
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

describe('story-sync bridge', () => {
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

  it('runs the LLM extraction and returns parsed patches with fallbackToRules=false', async () => {
    await seedConfig();
    registerStorySyncIpc();

    const llmText = JSON.stringify({
      summary: 'extracted clue',
      patches: [
        {
          field: 'foreshadow_registry',
          action: 'merge',
          data: { items: [{ id: 'fs_1', title: '钥匙', content: '一把钥匙' }] },
          fieldVersion: 2,
          generatedBy: 'IMPERSONATOR',
        },
      ],
    });
    const responseBody = JSON.stringify({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 0,
      model: 'gpt-4o-mini',
      choices: [{ index: 0, message: { role: 'assistant', content: llmText }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => JSON.parse(responseBody),
      text: async () => responseBody,
    } as unknown as Response)) as unknown as typeof globalThis.fetch;

    const handler = pickHandler('storySync:run');
    const result = (await handler({}, {
      ref: { keyId: 'key_text', modelId: 'gpt-4o-mini' },
      runId: 'run_1',
      chapterId: 'ch_1',
      candidate: { content: '一把铜钥匙' },
      context: {},
      fieldVersions: { foreshadow_registry: 2 },
    })) as { patches: unknown[]; fallbackToRules: boolean; summary: string };

    expect(result.fallbackToRules).toBe(false);
    expect(result.patches).toHaveLength(1);
    expect((result.patches[0] as Record<string, unknown>).generatedBy).toBe('story-sync-agent');
  });

  it('returns fallbackToRules=true when adapter throws ProtocolHttpError', async () => {
    await seedConfig();
    registerStorySyncIpc();

    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      headers: new Headers(),
      json: async () => ({ error: { message: 'boom' } }),
      text: async () => JSON.stringify({ error: { message: 'boom' } }),
    } as unknown as Response)) as unknown as typeof globalThis.fetch;

    const handler = pickHandler('storySync:run');
    const result = (await handler({}, {
      ref: { keyId: 'key_text', modelId: 'gpt-4o-mini' },
      runId: 'run_1',
      chapterId: 'ch_1',
      candidate: { content: '...' },
      context: {},
      fieldVersions: {},
    })) as { patches: unknown[]; fallbackToRules: boolean; summary: string };

    expect(result.fallbackToRules).toBe(true);
    expect(result.patches).toEqual([]);
    expect(result.summary).toMatch(/falling back/i);
  });

  it('returns fallbackToRules=true when LLM emits non-JSON', async () => {
    await seedConfig();
    registerStorySyncIpc();

    const responseBody = JSON.stringify({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 0,
      model: 'gpt-4o-mini',
      choices: [{ index: 0, message: { role: 'assistant', content: 'sorry I cannot help' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => JSON.parse(responseBody),
      text: async () => responseBody,
    } as unknown as Response)) as unknown as typeof globalThis.fetch;

    const handler = pickHandler('storySync:run');
    const result = (await handler({}, {
      ref: { keyId: 'key_text', modelId: 'gpt-4o-mini' },
      runId: 'r',
      chapterId: 'c',
      candidate: { content: '...' },
      context: {},
      fieldVersions: {},
    })) as { fallbackToRules: boolean; summary: string };

    expect(result.fallbackToRules).toBe(true);
    expect(result.summary).toMatch(/parse failed/i);
  });

  it('returns fallbackToRules=true when key is missing', async () => {
    registerStorySyncIpc();

    globalThis.fetch = vi.fn();

    const handler = pickHandler('storySync:run');
    const result = (await handler({}, {
      ref: { keyId: 'no_such', modelId: 'gpt-4o' },
      runId: 'r',
      chapterId: 'c',
      candidate: { content: '...' },
      context: {},
      fieldVersions: {},
    })) as { fallbackToRules: boolean };
    expect(result.fallbackToRules).toBe(true);
  });
});
