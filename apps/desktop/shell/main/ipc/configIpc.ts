import { ipcMain } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

type ModelConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-5.4'
};

function getConfigPath(): string {
  return path.join(os.homedir(), '.orison', 'config.json');
}

function readModelConfig(): ModelConfig {
  const p = getConfigPath();
  try {
    if (!existsSync(p)) return { ...DEFAULT_MODEL_CONFIG };
    const raw = JSON.parse(readFileSync(p, 'utf-8'));
    return {
      apiKey: typeof raw?.model?.apiKey === 'string' ? raw.model.apiKey : DEFAULT_MODEL_CONFIG.apiKey,
      baseUrl: typeof raw?.model?.baseUrl === 'string' ? raw.model.baseUrl : DEFAULT_MODEL_CONFIG.baseUrl,
      model: typeof raw?.model?.model === 'string' ? raw.model.model : DEFAULT_MODEL_CONFIG.model,
    };
  } catch {
    return { ...DEFAULT_MODEL_CONFIG };
  }
}

function writeModelConfig(config: ModelConfig): void {
  const p = getConfigPath();
  const dir = path.dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let existing: Record<string, unknown> = {};
  try {
    if (existsSync(p)) existing = JSON.parse(readFileSync(p, 'utf-8'));
  } catch { /* ignore */ }

  existing.model = config;
  writeFileSync(p, JSON.stringify(existing, null, 2), 'utf-8');
}

export function registerConfigIpc() {
  ipcMain.handle('config:load-model', () => readModelConfig());
  ipcMain.handle('config:save-model', (_, config: ModelConfig) => {
    writeModelConfig(config);
  });
}
