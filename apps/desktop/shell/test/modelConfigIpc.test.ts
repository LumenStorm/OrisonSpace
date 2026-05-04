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
      id: 'model_001',
      name: 'Main relay',
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://relay.example.com/v1',
      model: 'gpt-4o-mini',
      capabilities: ['text'],
    },
    {
      id: 'model_002',
      name: 'Image relay',
      provider: 'openai',
      apiKey: 'sk-image',
      baseUrl: 'https://relay.example.com/v1',
      model: 'gpt-image-1',
      capabilities: ['image'],
    },
  ],
  selected: {
    novel: 'model_001',
    image: 'model_002',
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

  it('writes one YAML file per model profile and an index file', async () => {
    registerConfigIpc();
    const saveCall = handle.mock.calls.find(([channel]) => channel === 'config:save-model');
    expect(saveCall).toBeTruthy();

    const [, saveHandler] = saveCall!;
    await saveHandler({}, SAMPLE_CONFIG);

    const index = parseFlatYaml(readFileSync(path.join(TEST_MODEL_DIR, 'index.yaml'), 'utf-8'));
    expect(index).toMatchObject({
      version: 2,
      order: 'model_001,model_002',
      'selected.novel': 'model_001',
      'selected.image': 'model_002',
    });

    const profile = parseFlatYaml(readFileSync(path.join(TEST_MODEL_DIR, 'profiles', 'model_001.yaml'), 'utf-8'));
    expect(profile).toMatchObject({
      id: 'model_001',
      name: 'Main relay',
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://relay.example.com/v1',
      model: 'gpt-4o-mini',
      capabilities: 'text',
    });
  });

  it('migrates legacy config.yaml into model profiles on read', async () => {
    mkdirSync(TEST_MODEL_DIR, { recursive: true });
    writeFileSync(path.join(TEST_MODEL_DIR, 'config.yaml'), stringifyFlatYaml({
      'novel.provider': 'openai',
      'novel.apiKey': 'legacy-key',
      'novel.baseUrl': 'https://relay.example.com/v1',
      'novel.model': 'gpt-4o-mini',
    }), 'utf-8');

    registerConfigIpc();
    const loadCall = handle.mock.calls.find(([channel]) => channel === 'config:load-model');
    expect(loadCall).toBeTruthy();

    const [, loadHandler] = loadCall!;
    expect(loadHandler({})).toMatchObject({
      profiles: [{
        id: 'model_001',
        provider: 'openai',
        apiKey: 'legacy-key',
        model: 'gpt-4o-mini',
        capabilities: ['text'],
      }],
      selected: {
        novel: 'model_001',
        image: null,
        video: null,
      },
    });
  });
});
