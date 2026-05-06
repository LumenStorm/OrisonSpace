import path from 'node:path';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const TEST_MODEL_DIR = path.join(process.cwd(), 'test-tmp-model-config-migration');

describe('config IPC migration v1 -> v2', () => {
  beforeEach(() => {
    handle.mockReset();
    _setModelConfigDirForTest(TEST_MODEL_DIR);
    if (existsSync(TEST_MODEL_DIR)) rmSync(TEST_MODEL_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    _setModelConfigDirForTest(null);
    if (existsSync(TEST_MODEL_DIR)) rmSync(TEST_MODEL_DIR, { recursive: true, force: true });
  });

  it('reads a v1 single-model profile YAML and returns a v2 shape with models[]', async () => {
    mkdirSync(path.join(TEST_MODEL_DIR, 'profiles'), { recursive: true });
    writeFileSync(
      path.join(TEST_MODEL_DIR, 'index.yaml'),
      stringifyFlatYaml({
        version: 2,
        order: 'profile_legacy',
        'selected.novel': 'profile_legacy',
        'selected.image': null,
        'selected.video': null,
      }),
      'utf-8',
    );
    writeFileSync(
      path.join(TEST_MODEL_DIR, 'profiles', 'profile_legacy.yaml'),
      stringifyFlatYaml({
        id: 'profile_legacy',
        name: 'Legacy OpenAI',
        provider: 'openai',
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        capabilities: 'text',
      }),
      'utf-8',
    );

    registerConfigIpc();
    const loadCall = handle.mock.calls.find(([channel]) => channel === 'config:load-model');
    expect(loadCall).toBeTruthy();
    const [, loadHandler] = loadCall!;

    const config = (await loadHandler({})) as ModelConfig;

    expect(config.profiles).toHaveLength(1);
    const profile = config.profiles[0]!;
    expect(profile.id).toBe('profile_legacy');
    expect(profile.models).toEqual([
      expect.objectContaining({
        id: 'gpt-4o',
        alias: expect.any(String),
        apiFormat: 'openai-chat-completions',
        capabilities: ['text'],
      }),
    ]);
    expect(config.selected.novel).toEqual({
      profileId: 'profile_legacy',
      modelId: 'gpt-4o',
    });
  });

  it('reads a v2 profile YAML with explicit models[] unchanged', async () => {
    mkdirSync(path.join(TEST_MODEL_DIR, 'profiles'), { recursive: true });
    writeFileSync(
      path.join(TEST_MODEL_DIR, 'index.yaml'),
      stringifyFlatYaml({
        version: 2,
        order: 'profile_v2',
        'selected.novel.profileId': 'profile_v2',
        'selected.novel.modelId': 'gpt-4o',
        'selected.image.profileId': 'profile_v2',
        'selected.image.modelId': 'dall-e-3',
        'selected.video.profileId': null,
        'selected.video.modelId': null,
      }),
      'utf-8',
    );
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

    const profile = config.profiles[0]!;
    expect(profile.id).toBe('profile_v2');
    expect(profile.models).toHaveLength(2);
    expect(profile.models.map((m) => m.id).sort()).toEqual(['dall-e-3', 'gpt-4o']);
    expect(config.selected.novel).toEqual({ profileId: 'profile_v2', modelId: 'gpt-4o' });
    expect(config.selected.image).toEqual({ profileId: 'profile_v2', modelId: 'dall-e-3' });
    expect(config.selected.video).toBeNull();
  });

  it('writes a v2-shaped index.yaml when saving', async () => {
    registerConfigIpc();
    const saveCall = handle.mock.calls.find(([channel]) => channel === 'config:save-model');
    const [, saveHandler] = saveCall!;

    const config: ModelConfig = {
      profiles: [
        {
          schemaVersion: 2,
          id: 'profile_x',
          name: 'X',
          provider: 'openai',
          apiKey: 'sk-x',
          baseUrl: 'https://relay.example.com/v1',
          models: [
            { id: 'gpt-4o', alias: 'GPT 4o', apiFormat: 'openai-chat-completions', capabilities: ['text'] },
          ],
        },
      ],
      selected: {
        novel: { profileId: 'profile_x', modelId: 'gpt-4o' },
        image: null,
        video: null,
      },
    };

    await saveHandler({}, config);

    const index = parseFlatYaml(readFileSync(path.join(TEST_MODEL_DIR, 'index.yaml'), 'utf-8'));
    expect(index).toMatchObject({
      version: 2,
      order: 'profile_x',
      'selected.novel.profileId': 'profile_x',
      'selected.novel.modelId': 'gpt-4o',
    });

    const profile = parseFlatYaml(readFileSync(path.join(TEST_MODEL_DIR, 'profiles', 'profile_x.yaml'), 'utf-8'));
    expect(profile).toMatchObject({
      schemaVersion: 2,
      id: 'profile_x',
      provider: 'openai',
      'models.0.id': 'gpt-4o',
      'models.0.apiFormat': 'openai-chat-completions',
    });
  });

  it('drops a slot pointing to a non-existent model and surfaces the dangling reference as null', async () => {
    mkdirSync(path.join(TEST_MODEL_DIR, 'profiles'), { recursive: true });
    writeFileSync(
      path.join(TEST_MODEL_DIR, 'index.yaml'),
      stringifyFlatYaml({
        version: 2,
        order: 'profile_v2',
        'selected.novel.profileId': 'profile_v2',
        'selected.novel.modelId': 'gone-model',
      }),
      'utf-8',
    );
    writeFileSync(
      path.join(TEST_MODEL_DIR, 'profiles', 'profile_v2.yaml'),
      stringifyFlatYaml({
        schemaVersion: 2,
        id: 'profile_v2',
        name: 'P',
        provider: 'openai',
        apiKey: 'sk',
        baseUrl: 'https://relay.example.com/v1',
        'models.0.id': 'gpt-4o',
        'models.0.alias': 'GPT 4o',
        'models.0.apiFormat': 'openai-chat-completions',
        'models.0.capabilities': 'text',
      }),
      'utf-8',
    );

    registerConfigIpc();
    const loadCall = handle.mock.calls.find(([channel]) => channel === 'config:load-model');
    const [, loadHandler] = loadCall!;
    const config = (await loadHandler({})) as ModelConfig;
    expect(config.selected.novel).toBeNull();
  });
});
