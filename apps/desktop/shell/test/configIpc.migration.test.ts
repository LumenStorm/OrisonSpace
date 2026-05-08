import path from 'node:path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stringifyFlatYaml, type ModelConfig } from '@orison/shared-contracts';

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

const TEST_MODEL_DIR = path.join(process.cwd(), 'test-tmp-model-config-migration');

describe('config IPC migration profiles -> keys', () => {
  beforeEach(() => {
    handle.mockReset();
    _setModelConfigDirForTest(TEST_MODEL_DIR);
    if (existsSync(TEST_MODEL_DIR)) rmSync(TEST_MODEL_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    _setModelConfigDirForTest(null);
    if (existsSync(TEST_MODEL_DIR)) rmSync(TEST_MODEL_DIR, { recursive: true, force: true });
  });

  it('migrates old profiles/ directory into new keys/ on first read', async () => {
    mkdirSync(path.join(TEST_MODEL_DIR, 'profiles'), { recursive: true });
    writeFileSync(
      path.join(TEST_MODEL_DIR, 'profiles', 'profile_v2.yaml'),
      stringifyFlatYaml({
        schemaVersion: 2,
        id: 'profile_v2',
        name: 'Mixed',
        provider: 'openai',
        apiKey: 'sk-multi',
        baseUrl: 'https://relay.example.com/v1',
        'models.0.id': 'gpt-4o',
        'models.0.alias': 'GPT 4o',
        'models.0.apiFormat': 'openai-chat-completions',
        'models.0.capabilities': 'text',
        'models.1.id': 'dall-e-3',
        'models.1.alias': 'DALL-E 3',
        'models.1.apiFormat': 'openai-images',
        'models.1.capabilities': 'image',
      }),
      'utf-8',
    );

    registerConfigIpc();
    const loadCall = handle.mock.calls.find(([channel]) => channel === 'config:load-model');
    const [, loadHandler] = loadCall!;
    const config = (await loadHandler({})) as ModelConfig;

    expect(config.keys).toHaveLength(1);
    const key = config.keys[0]!;
    expect(key.id).toBe('profile_v2');
    expect(key.name).toBe('Mixed');
    expect(key.apiKey).toBe('sk-multi');
    expect(key.models).toHaveLength(2);
    expect(key.models[0]).toMatchObject({ id: 'gpt-4o', capability: 'text', enabled: true });
    expect(key.models[1]).toMatchObject({ id: 'dall-e-3', capability: 'image', enabled: true });

    // Should have written keys/ directory
    expect(existsSync(path.join(TEST_MODEL_DIR, 'keys', 'profile_v2.yaml'))).toBe(true);
  });

  it('returns empty config when no profiles/ and no keys/ exist', async () => {
    registerConfigIpc();
    const loadCall = handle.mock.calls.find(([channel]) => channel === 'config:load-model');
    const [, loadHandler] = loadCall!;
    const config = (await loadHandler({})) as ModelConfig;

    expect(config.keys).toEqual([]);
  });
});
