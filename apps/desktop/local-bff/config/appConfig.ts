import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseFlatYaml, stringifyFlatYaml, type ModelConfig } from '@orison/shared-contracts';

export type AppConfig = {
  model: ModelConfig;
};

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  models: {
    novel: { provider: 'openai', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: '' },
    image: { provider: 'openai', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: '' },
    video: { provider: 'openai', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: '' },
  },
};

function getConfigDir(): string {
  return path.join(os.homedir(), '.orison', 'model');
}

function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.yaml');
}

/** 允许测试时注入自定义路径 */
let overridePath: string | null = null;
export function _setConfigPathForTest(p: string | null) { overridePath = p; }
function resolvedPath(): string { return overridePath ?? getConfigPath(); }

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function parseModelConfig(raw: unknown): ModelConfig {
  const source = asRecord(raw);
  return {
    models: {
      novel: readModelSlot(source, 'novel'),
      image: readModelSlot(source, 'image'),
      video: readModelSlot(source, 'video'),
    },
  };
}

function readModelSlot(source: Record<string, unknown>, type: 'novel' | 'image' | 'video') {
  const fallback = DEFAULT_MODEL_CONFIG.models[type];
  const legacyModel = type === 'novel' ? source.novelModel ?? source.model : type === 'image' ? source.imageModel : source.videoModel;
  return {
    provider: readProvider(source[`${type}.provider`] ?? (type === 'novel' ? source.provider : undefined), fallback.provider),
    apiKey: readString(source[`${type}.apiKey`] ?? (type === 'novel' ? source.apiKey : undefined), fallback.apiKey),
    baseUrl: readString(source[`${type}.baseUrl`] ?? (type === 'novel' ? source.baseUrl : undefined), fallback.baseUrl),
    model: readString(source[`${type}.model`] ?? legacyModel, fallback.model),
  };
}

function readProvider(value: unknown, fallback: 'openai' | 'gcp' | 'anthropic') {
  return value === 'gcp' || value === 'anthropic' || value === 'openai' ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function loadAppConfig(): AppConfig {
  const p = resolvedPath();
  try {
    if (existsSync(p)) {
      return { model: parseModelConfig(parseFlatYaml(readFileSync(p, 'utf-8'))) };
    }
  } catch { /* fall through */ }

  return { model: { ...DEFAULT_MODEL_CONFIG } };
}

export function saveAppConfig(config: AppConfig): void {
  const p = resolvedPath();
  const dir = path.dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const flat = Object.fromEntries(
    (['novel', 'image', 'video'] as const).flatMap((type) => {
      const slot = config.model.models[type];
      return [
        [`${type}.provider`, slot.provider],
        [`${type}.apiKey`, slot.apiKey],
        [`${type}.baseUrl`, slot.baseUrl],
        [`${type}.model`, slot.model],
      ];
    }),
  );
  writeFileSync(p, stringifyFlatYaml(flat), 'utf-8');
}

export function getModelConfig(): ModelConfig {
  return loadAppConfig().model;
}

export function saveModelConfig(config: ModelConfig): void {
  const current = loadAppConfig();
  saveAppConfig({ ...current, model: config });
}
