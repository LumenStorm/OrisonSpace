import path from 'node:path';
import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFlatYaml, stringifyFlatYaml, type ModelConfig } from '@orison/shared-contracts';

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

const TEST_MODEL_DIR = path.join(process.cwd(), 'test-tmp-model-config');

const SAMPLE_CONFIG: ModelConfig = {
  profiles: [
    {
      schemaVersion: 2,
      id: 'model_001',
      name: 'Main relay',
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://relay.example.com/v1',
      models: [
        {
          id: 'gpt-4o-mini',
          alias: 'GPT 4o mini',
          apiFormat: 'openai-chat-completions',
          capabilities: ['text'],
        },
      ],
    },
    {
      schemaVersion: 2,
      id: 'model_002',
      name: 'Image relay',
      provider: 'openai',
      apiKey: 'sk-image',
      baseUrl: 'https://relay.example.com/v1',
      models: [
        {
          id: 'gpt-image-1',
          alias: 'GPT Image 1',
          apiFormat: 'openai-images',
          capabilities: ['image'],
        },
      ],
    },
  ],
  selected: {
    novel: { profileId: 'model_001', modelId: 'gpt-4o-mini' },
    image: { profileId: 'model_002', modelId: 'gpt-image-1' },
    video: null,
  },
};

describe('model config IPC', () => {
  beforeEach(() => {
    handle.mockReset();
    _setModelConfigDirForTest(TEST_MODEL_DIR);
    if (existsSync(TEST_MODEL_DIR)) rmSync(TEST_MODEL_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    _setModelConfigDirForTest(null);
    if (existsSync(TEST_MODEL_DIR)) rmSync(TEST_MODEL_DIR, { recursive: true, force: true });
  });

  it('writes one v2 YAML file per profile and a v2 index', async () => {
    registerConfigIpc();
    const saveCall = handle.mock.calls.find(([channel]) => channel === 'config:save-model');
    expect(saveCall).toBeTruthy();

    const [, saveHandler] = saveCall!;
    await saveHandler({}, SAMPLE_CONFIG);

    const index = parseFlatYaml(readFileSync(path.join(TEST_MODEL_DIR, 'index.yaml'), 'utf-8'));
    expect(index).toMatchObject({
      version: 2,
      order: 'model_001,model_002',
      'selected.novel.profileId': 'model_001',
      'selected.novel.modelId': 'gpt-4o-mini',
      'selected.image.profileId': 'model_002',
      'selected.image.modelId': 'gpt-image-1',
    });

    const profile = parseFlatYaml(readFileSync(path.join(TEST_MODEL_DIR, 'profiles', 'model_001.yaml'), 'utf-8'));
    expect(profile).toMatchObject({
      schemaVersion: 2,
      id: 'model_001',
      name: 'Main relay',
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://relay.example.com/v1',
      'models.0.id': 'gpt-4o-mini',
      'models.0.apiFormat': 'openai-chat-completions',
      'models.0.capabilities': 'text',
    });
  });

  it('migrates legacy config.yaml into v2 model profiles on read', async () => {
    mkdirSync(TEST_MODEL_DIR, { recursive: true });
    writeFileSync(
      path.join(TEST_MODEL_DIR, 'config.yaml'),
      stringifyFlatYaml({
        'novel.provider': 'openai',
        'novel.apiKey': 'legacy-key',
        'novel.baseUrl': 'https://relay.example.com/v1',
        'novel.model': 'gpt-4o-mini',
      }),
      'utf-8',
    );

    registerConfigIpc();
    const loadCall = handle.mock.calls.find(([channel]) => channel === 'config:load-model');
    expect(loadCall).toBeTruthy();

    const [, loadHandler] = loadCall!;
    const result = (await loadHandler({})) as ModelConfig;
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0]).toMatchObject({
      schemaVersion: 2,
      id: 'model_001',
      provider: 'openai',
      apiKey: 'legacy-key',
    });
    expect(result.profiles[0]!.models).toEqual([
      expect.objectContaining({ id: 'gpt-4o-mini', apiFormat: 'openai-chat-completions', capabilities: ['text'] }),
    ]);
    expect(result.selected.novel).toEqual({ profileId: 'model_001', modelId: 'gpt-4o-mini' });
    expect(result.selected.image).toBeNull();
    expect(result.selected.video).toBeNull();
  });
});
