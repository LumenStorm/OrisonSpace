import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type ModelConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type AppConfig = {
  model: ModelConfig;
};

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-5.4'
};

function getConfigDir(): string {
  return path.join(os.homedir(), '.orison', 'model');
}

function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
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
    apiKey: typeof source?.apiKey === 'string' ? source.apiKey : DEFAULT_MODEL_CONFIG.apiKey,
    baseUrl: typeof source?.baseUrl === 'string' ? source.baseUrl : DEFAULT_MODEL_CONFIG.baseUrl,
    model: typeof source?.model === 'string' ? source.model : DEFAULT_MODEL_CONFIG.model,
  };
}

export function loadAppConfig(): AppConfig {
  const p = resolvedPath();
  try {
    if (existsSync(p)) {
      return { model: parseModelConfig(JSON.parse(readFileSync(p, 'utf-8'))) };
    }
  } catch { /* fall through */ }

  return { model: { ...DEFAULT_MODEL_CONFIG } };
}

export function saveAppConfig(config: AppConfig): void {
  const p = resolvedPath();
  const dir = path.dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(p, JSON.stringify(config.model, null, 2), 'utf-8');
}

export function getModelConfig(): ModelConfig {
  return loadAppConfig().model;
}

export function saveModelConfig(config: ModelConfig): void {
  const current = loadAppConfig();
  saveAppConfig({ ...current, model: config });
}
