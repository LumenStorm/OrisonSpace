import { ipcMain, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ModelConfig, UserPreferencesConfig } from '@orison/shared-contracts';
import { parseFlatYaml, stringifyFlatYaml } from '@orison/shared-contracts';

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  models: {
    novel: { provider: 'openai', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: '' },
    image: { provider: 'openai', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: '' },
    video: { provider: 'openai', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: '' },
  },
};

const DEFAULT_USER_PREFERENCES: UserPreferencesConfig = {
  theme: 'system',
  locale: 'system',
  autoApplyPatches: true
};

function getModelConfigPath(): string {
  return path.join(os.homedir(), '.orison', 'model', 'config.yaml');
}

function getUserPreferencesPath(): string {
  return path.join(os.homedir(), '.orison', 'user', 'preferences.yaml');
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
    const raw = parseFlatYaml(readFileSync(p, 'utf-8'));
    return {
      models: {
        novel: readModelSlot(raw, 'novel'),
        image: readModelSlot(raw, 'image'),
        video: readModelSlot(raw, 'video'),
      },
    };
  } catch {
    return { ...DEFAULT_MODEL_CONFIG };
  }
}

function readModelSlot(raw: Record<string, unknown>, type: 'novel' | 'image' | 'video') {
  const fallback = DEFAULT_MODEL_CONFIG.models[type];
  const encrypted = raw[`${type}.apiKey`];
  const legacyApiKey = type === 'novel' ? raw.apiKey : undefined;
  const apiKey = typeof encrypted === 'string'
    ? decrypt(encrypted)
    : typeof legacyApiKey === 'string'
      ? decrypt(legacyApiKey)
      : fallback.apiKey;
  const legacyModel = type === 'novel' ? raw.novelModel ?? raw.model : type === 'image' ? raw.imageModel : raw.videoModel;

  return {
    provider: readProvider(raw[`${type}.provider`] ?? (type === 'novel' ? raw.provider : undefined), fallback.provider),
    apiKey,
    baseUrl: readString(raw[`${type}.baseUrl`] ?? (type === 'novel' ? raw.baseUrl : undefined), fallback.baseUrl),
    model: readString(raw[`${type}.model`] ?? legacyModel, fallback.model),
  };
}

function readProvider(value: unknown, fallback: 'openai' | 'gcp' | 'anthropic') {
  return value === 'gcp' || value === 'anthropic' || value === 'openai' ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function writeModelConfig(config: ModelConfig): void {
  const p = getModelConfigPath();
  const dir = path.dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const saved = Object.fromEntries(
    (['novel', 'image', 'video'] as const).flatMap((type) => {
      const slot = config.models[type];
      return [
        [`${type}.provider`, slot.provider],
        [`${type}.apiKey`, encrypt(slot.apiKey)],
        [`${type}.baseUrl`, slot.baseUrl],
        [`${type}.model`, slot.model],
      ];
    }),
  );
  writeFileSync(p, stringifyFlatYaml(saved), 'utf-8');
}

function readUserPreferences(): UserPreferencesConfig {
  const p = getUserPreferencesPath();
  try {
    if (!existsSync(p)) return { ...DEFAULT_USER_PREFERENCES };
    const raw = parseFlatYaml(readFileSync(p, 'utf-8'));
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
  writeFileSync(p, stringifyFlatYaml(config), 'utf-8');
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
