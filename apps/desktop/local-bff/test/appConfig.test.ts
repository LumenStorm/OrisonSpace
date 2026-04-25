import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { saveModelConfig, getModelConfig, loadAppConfig, _setConfigPathForTest } from '../config/appConfig';

const TEST_CONFIG_PATH = path.join(process.cwd(), 'test-tmp-config', 'config.json');

describe('appConfig', () => {
  afterEach(() => {
    _setConfigPathForTest(null);
    const dir = path.dirname(TEST_CONFIG_PATH);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it('返回默认值当配置文件不存在', () => {
    _setConfigPathForTest(TEST_CONFIG_PATH);
    const config = getModelConfig();
    expect(config.apiKey).toBe('');
    expect(config.baseUrl).toBe('https://api.openai.com/v1');
    expect(config.model).toBe('gpt-5.4');
  });

  it('saveModelConfig → getModelConfig 往返正确', () => {
    _setConfigPathForTest(TEST_CONFIG_PATH);
    saveModelConfig({
      apiKey: 'sk-test-123',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat'
    });

    const loaded = getModelConfig();
    expect(loaded.apiKey).toBe('sk-test-123');
    expect(loaded.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(loaded.model).toBe('deepseek-chat');
  });

  it('自动创建目录', () => {
    _setConfigPathForTest(TEST_CONFIG_PATH);
    expect(existsSync(path.dirname(TEST_CONFIG_PATH))).toBe(false);

    saveModelConfig({ apiKey: 'key', baseUrl: 'url', model: 'model' });
    expect(existsSync(TEST_CONFIG_PATH)).toBe(true);
  });

  it('保留其他配置字段', () => {
    _setConfigPathForTest(TEST_CONFIG_PATH);
    saveModelConfig({ apiKey: 'k1', baseUrl: 'u1', model: 'm1' });
    saveModelConfig({ apiKey: 'k2', baseUrl: 'u2', model: 'm2' });

    const full = loadAppConfig();
    expect(full.model.apiKey).toBe('k2');
  });
});
