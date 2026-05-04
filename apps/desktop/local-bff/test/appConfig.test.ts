import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { saveModelConfig, getModelConfig, loadAppConfig, _setConfigPathForTest } from '../config/appConfig';
import { parseFlatYaml, stringifyFlatYaml } from '@orison/shared-contracts';
import type { ModelConfig } from '@orison/shared-contracts';

const TEST_CONFIG_PATH = path.join(process.cwd(), 'test-tmp-config', 'config.yaml');

const SAMPLE_CONFIG: ModelConfig = {
  profiles: [
    {
      id: 'model_001',
      name: 'Novel relay',
      provider: 'openai',
      apiKey: 'novel-key',
      baseUrl: 'https://api.novel.example/v1',
      model: 'gpt-5.5',
      capabilities: ['text'],
    },
    {
      id: 'model_002',
      name: 'Image model',
      provider: 'gcp',
      apiKey: 'image-key',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      model: 'imagen-3.0-generate-001',
      capabilities: ['image'],
    },
  ],
  selected: {
    novel: 'model_001',
    image: 'model_002',
    video: null,
  },
};

describe('appConfig', () => {
  afterEach(() => {
    _setConfigPathForTest(null);
    const dir = path.dirname(TEST_CONFIG_PATH);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it('returns defaults when the config file does not exist', () => {
    _setConfigPathForTest(TEST_CONFIG_PATH);
    const config = getModelConfig();
    expect(config.profiles).toEqual([]);
    expect(config.selected).toEqual({ novel: null, image: null, video: null });
  });

  it('round-trips model profiles', () => {
    _setConfigPathForTest(TEST_CONFIG_PATH);
    saveModelConfig(SAMPLE_CONFIG);

    const loaded = getModelConfig();
    expect(loaded.profiles[0]?.apiKey).toBe('novel-key');
    expect(loaded.profiles[0]?.model).toBe('gpt-5.5');
    expect(loaded.profiles[1]?.provider).toBe('gcp');
    expect(loaded.selected.image).toBe('model_002');
  });

  it('creates the config directory automatically', () => {
    _setConfigPathForTest(TEST_CONFIG_PATH);
    expect(existsSync(path.dirname(TEST_CONFIG_PATH))).toBe(false);

    saveModelConfig(SAMPLE_CONFIG);
    expect(existsSync(TEST_CONFIG_PATH)).toBe(true);
  });

  it('keeps the latest model config', () => {
    _setConfigPathForTest(TEST_CONFIG_PATH);
    saveModelConfig(SAMPLE_CONFIG);
    saveModelConfig({
      ...SAMPLE_CONFIG,
      profiles: [
        { ...SAMPLE_CONFIG.profiles[0]!, apiKey: 'latest-key', model: 'latest-model' },
        SAMPLE_CONFIG.profiles[1]!,
      ],
    });

    const full = loadAppConfig();
    expect(full.model.profiles[0]?.apiKey).toBe('latest-key');
    expect(full.model.profiles[0]?.model).toBe('latest-model');
  });

  it('stores model config as JSON in the standalone YAML config file', () => {
    _setConfigPathForTest(TEST_CONFIG_PATH);
    saveModelConfig(SAMPLE_CONFIG);

    const raw = parseFlatYaml(readFileSync(TEST_CONFIG_PATH, 'utf-8'));
    expect(typeof raw.profilesJson).toBe('string');
    expect(JSON.parse(raw.profilesJson as string)).toMatchObject({
      selected: { novel: 'model_001', image: 'model_002', video: null },
    });
  });

  it('maps legacy model config to model profiles on read', () => {
    _setConfigPathForTest(TEST_CONFIG_PATH);
    const legacy = {
      apiKey: 'legacy-key',
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      model: 'legacy-model',
    };
    mkdirSync(path.dirname(TEST_CONFIG_PATH), { recursive: true });
    writeFileSync(TEST_CONFIG_PATH, stringifyFlatYaml(legacy), 'utf-8');

    const loaded = getModelConfig();
    expect(loaded.profiles[0]).toMatchObject({
      provider: 'anthropic',
      apiKey: 'legacy-key',
      model: 'legacy-model',
      capabilities: ['text'],
    });
    expect(loaded.selected.novel).toBe('model_001');
    expect(loaded.selected.image).toBeNull();
  });
});
