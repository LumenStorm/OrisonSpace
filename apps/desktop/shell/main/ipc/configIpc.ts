import { ipcMain, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ModelConfig } from '@orison/shared-contracts';

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o'
};

function getConfigPath(): string {
  return path.join(os.homedir(), '.orison', 'config.json');
}

/** Encrypt a string using Electron's safeStorage (OS keychain). Falls back to plain text if unavailable. */
function encrypt(value: string): string {
  if (!value) return '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(value).toString('base64');
    }
  } catch { /* fall through */ }
  return value;
}

/** Decrypt a string previously encrypted with safeStorage. */
function decrypt(value: string): string {
  if (!value) return '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(value, 'base64');
      return safeStorage.decryptString(buf);
    }
  } catch { /* fall through — may be plain text from before encryption was enabled */ }
  return value;
}

function readModelConfig(): ModelConfig {
  const p = getConfigPath();
  try {
    if (!existsSync(p)) return { ...DEFAULT_MODEL_CONFIG };
    const raw = JSON.parse(readFileSync(p, 'utf-8'));
    const encrypted = typeof raw?.model?.apiKey === 'string' ? raw.model.apiKey : '';
    return {
      apiKey: decrypt(encrypted),
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

  existing.model = {
    apiKey: encrypt(config.apiKey),
    baseUrl: config.baseUrl,
    model: config.model,
  };
  writeFileSync(p, JSON.stringify(existing, null, 2), 'utf-8');
}

export function registerConfigIpc() {
  ipcMain.handle('config:load-model', () => readModelConfig());
  ipcMain.handle('config:save-model', (_, config: ModelConfig) => {
    writeModelConfig(config);
  });
}
