import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { saveModelConfig, getModelConfig, loadAppConfig, _setConfigPathForTest } from '../config/appConfig';
import { parseFlatYaml, stringifyFlatYaml } from '@orison/shared-contracts';
import type { ModelConfig } from '@orison/shared-contracts';

const TEST_CONFIG_PATH = path.join(process.cwd(), 'test-tmp-config', 'config.yaml');

const SAMPLE_CONFIG: ModelConfig = {
  models: {
    novel: {
      provider: 'openai',
      apiKey: 'novel-key',
      baseUrl: 'https://api.novel.example/v1',
      model: 'gpt-5.5',
    },
    image: {
      provider: 'gcp',
      apiKey: 'image-key',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      model: 'imagen-3.0-generate-001',
    },
    video: {
      provider: 'openai',
      apiKey: 'video-key',
      baseUrl: 'https://api.video.example/v1',
      model: 'placeholder-video',
    },
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
    expect(config.models.novel.provider).toBe('openai');
    expect(config.models.novel.model).toBe('');
    expect(config.models.image.model).toBe('');
    expect(config.models.video.model).toBe('');
  });

  it('round-trips model config by model type', () => {
    _setConfigPathForTest(TEST_CONFIG_PATH);
    saveModelConfig(SAMPLE_CONFIG);

    const loaded = getModelConfig();
    expect(loaded.models.novel.apiKey).toBe('novel-key');
    expect(loaded.models.novel.model).toBe('gpt-5.5');
    expect(loaded.models.image.provider).toBe('gcp');
    expect(loaded.models.image.model).toBe('imagen-3.0-generate-001');
    expect(loaded.models.video.baseUrl).toBe('https://api.video.example/v1');
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
      models: {
        ...SAMPLE_CONFIG.models,
        novel: { ...SAMPLE_CONFIG.models.novel, apiKey: 'latest-key', model: 'latest-model' },
      },
    });

    const full = loadAppConfig();
    expect(full.model.models.novel.apiKey).toBe('latest-key');
    expect(full.model.models.novel.model).toBe('latest-model');
  });

  it('stores model config as a standalone YAML model config file', () => {
    _setConfigPathForTest(TEST_CONFIG_PATH);
    saveModelConfig(SAMPLE_CONFIG);

    const raw = parseFlatYaml(readFileSync(TEST_CONFIG_PATH, 'utf-8'));
    expect(raw).toEqual({
      'novel.provider': 'openai',
      'novel.apiKey': 'novel-key',
      'novel.baseUrl': 'https://api.novel.example/v1',
      'novel.model': 'gpt-5.5',
      'image.provider': 'gcp',
      'image.apiKey': 'image-key',
      'image.baseUrl': 'https://generativelanguage.googleapis.com/v1beta',
      'image.model': 'imagen-3.0-generate-001',
      'video.provider': 'openai',
      'video.apiKey': 'video-key',
      'video.baseUrl': 'https://api.video.example/v1',
      'video.model': 'placeholder-video',
    });
  });

  it('maps legacy model config to the novel slot on read', () => {
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
    expect(loaded.models.novel.provider).toBe('anthropic');
    expect(loaded.models.novel.apiKey).toBe('legacy-key');
    expect(loaded.models.novel.model).toBe('legacy-model');
    expect(loaded.models.image.model).toBe('');
  });
});
