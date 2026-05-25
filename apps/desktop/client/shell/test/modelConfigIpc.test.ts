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
  keys: [
    {
      id: 'key_001',
      name: 'Main relay',
      apiKey: 'sk-test',
      baseUrl: 'https://relay.example.com/v1',
      models: [
        { id: 'gpt-4o-mini', alias: 'GPT 4o mini', capability: 'text', enabled: true },
      ],
    },
    {
      id: 'key_002',
      name: 'Image relay',
      apiKey: 'sk-image',
      baseUrl: 'https://relay.example.com/v1',
      models: [
        { id: 'gpt-image-1', alias: 'GPT Image 1', capability: 'image', enabled: true },
      ],
    },
  ],
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

  it('writes one YAML file per key in keys/ directory', async () => {
    registerConfigIpc();
    const saveCall = handle.mock.calls.find(([channel]) => channel === 'config:save-model');
    expect(saveCall).toBeTruthy();

    const [, saveHandler] = saveCall!;
    await saveHandler({}, SAMPLE_CONFIG);

    const keyFile = parseFlatYaml(readFileSync(path.join(TEST_MODEL_DIR, 'keys', 'key_001.yaml'), 'utf-8'));
    expect(keyFile).toMatchObject({
      id: 'key_001',
      name: 'Main relay',
      apiKey: 'sk-test',
      baseUrl: 'https://relay.example.com/v1',
      'models.0.id': 'gpt-4o-mini',
      'models.0.capability': 'text',
      'models.0.alias': 'GPT 4o mini',
      'models.0.enabled': true,
    });
  });

  it('round-trips save then load', async () => {
    registerConfigIpc();
    const saveCall = handle.mock.calls.find(([channel]) => channel === 'config:save-model');
    const loadCall = handle.mock.calls.find(([channel]) => channel === 'config:load-model');

    await saveCall![1]({}, SAMPLE_CONFIG);
    const result = (await loadCall![1]({})) as ModelConfig;

    expect(result.keys).toHaveLength(2);
    expect(result.keys[0].id).toBe('key_001');
    expect(result.keys[0].models[0].id).toBe('gpt-4o-mini');
    expect(result.keys[1].id).toBe('key_002');
  });

  it('migrates old profile-based config on first read', async () => {
    // Seed old-style profiles directory
    const profilesDir = path.join(TEST_MODEL_DIR, 'profiles');
    mkdirSync(profilesDir, { recursive: true });
    writeFileSync(
      path.join(profilesDir, 'model_001.yaml'),
      stringifyFlatYaml({
        schemaVersion: 2,
        id: 'model_001',
        name: 'Legacy Profile',
        provider: 'openai',
        apiKey: 'legacy-key',
        baseUrl: 'https://relay.example.com/v1',
        'models.0.id': 'gpt-4o-mini',
        'models.0.alias': 'GPT 4o mini',
        'models.0.apiFormat': 'openai-chat-completions',
        'models.0.capabilities': 'text',
      }),
      'utf-8',
    );

    registerConfigIpc();
    const loadCall = handle.mock.calls.find(([channel]) => channel === 'config:load-model');
    const result = (await loadCall![1]({})) as ModelConfig;

    expect(result.keys).toHaveLength(1);
    expect(result.keys[0]).toMatchObject({
      id: 'model_001',
      name: 'Legacy Profile',
      apiKey: 'legacy-key',
      baseUrl: 'https://relay.example.com/v1',
    });
    expect(result.keys[0].models[0]).toMatchObject({
      id: 'gpt-4o-mini',
      capability: 'text',
      enabled: true,
    });
  });
});
