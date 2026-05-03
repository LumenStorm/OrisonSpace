import { ipcMain, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ModelConfig, UserPreferencesConfig } from '@orison/shared-contracts';

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o'
};

const DEFAULT_USER_PREFERENCES: UserPreferencesConfig = {
  theme: 'system',
  locale: 'system',
  autoApplyPatches: true
};

function getModelConfigPath(): string {
  return path.join(os.homedir(), '.orison', 'model', 'config.json');
}

function getUserPreferencesPath(): string {
  return path.join(os.homedir(), '.orison', 'user', 'preferences.json');
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
  const p = getModelConfigPath();
  try {
    if (!existsSync(p)) return { ...DEFAULT_MODEL_CONFIG };
    const raw = JSON.parse(readFileSync(p, 'utf-8'));
    const encrypted = typeof raw?.apiKey === 'string' ? raw.apiKey : '';
    return {
      apiKey: decrypt(encrypted),
      baseUrl: typeof raw?.baseUrl === 'string' ? raw.baseUrl : DEFAULT_MODEL_CONFIG.baseUrl,
      model: typeof raw?.model === 'string' ? raw.model : DEFAULT_MODEL_CONFIG.model,
    };
  } catch {
    return { ...DEFAULT_MODEL_CONFIG };
  }
}

function writeModelConfig(config: ModelConfig): void {
  const p = getModelConfigPath();
  const dir = path.dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const saved = {
    apiKey: encrypt(config.apiKey),
    baseUrl: config.baseUrl,
    model: config.model,
  };
  writeFileSync(p, JSON.stringify(saved, null, 2), 'utf-8');
}

function readUserPreferences(): UserPreferencesConfig {
  const p = getUserPreferencesPath();
  try {
    if (!existsSync(p)) return { ...DEFAULT_USER_PREFERENCES };
    const raw = JSON.parse(readFileSync(p, 'utf-8'));
    return {
      theme: typeof raw?.theme === 'string' ? raw.theme : DEFAULT_USER_PREFERENCES.theme,
      locale: typeof raw?.locale === 'string' ? raw.locale : DEFAULT_USER_PREFERENCES.locale,
      autoApplyPatches: typeof raw?.autoApplyPatches === 'boolean'
        ? raw.autoApplyPatches
        : DEFAULT_USER_PREFERENCES.autoApplyPatches,
    };
  } catch {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

function writeUserPreferences(config: UserPreferencesConfig): void {
  const p = getUserPreferencesPath();
  const dir = path.dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(p, JSON.stringify(config, null, 2), 'utf-8');
}

export function registerConfigIpc() {
  ipcMain.handle('config:load-model', () => readModelConfig());
  ipcMain.handle('config:save-model', (_, config: ModelConfig) => {
    writeModelConfig(config);
  });
  ipcMain.handle('config:load-user-preferences', () => readUserPreferences());
  ipcMain.handle('config:save-user-preferences', (_, config: UserPreferencesConfig) => {
    writeUserPreferences(config);
  });
}
