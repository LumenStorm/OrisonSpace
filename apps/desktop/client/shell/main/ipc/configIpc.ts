import { ipcMain, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type {
  ApiKeyEntry,
  ModelConfig,
  UserPreferencesConfig,
} from '@orison/shared-contracts';
import { parseFlatYaml, stringifyFlatYaml } from '@orison/shared-contracts';

const DEFAULT_MODEL_CONFIG: ModelConfig = { keys: [] };

const DEFAULT_USER_PREFERENCES: UserPreferencesConfig = {
  theme: 'system',
  locale: 'system',
  autoApplyPatches: true,
};

let modelDirOverride: string | null = null;

export function _setModelConfigDirForTest(dir: string | null) {
  modelDirOverride = dir;
}

function getModelDir(): string {
  return modelDirOverride ?? path.join(os.homedir(), '.orison', 'model');
}

function getKeysDir(): string {
  return path.join(getModelDir(), 'keys');
}

function getUserPreferencesPath(): string {
  return path.join(os.homedir(), '.orison', 'user', 'preferences.yaml');
}

function encrypt(value: string): string {
  if (!value) return '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(value).toString('base64');
    }
  } catch { /* fall through */ }
  return value;
}

function decrypt(value: string): string {
  if (!value) return '';
  // Only attempt safeStorage decryption if value looks like base64-encoded encrypted data
  // (safeStorage output is typically 80+ chars of pure base64 with padding)
  const isLikelyEncrypted = value.length > 60 && /^[A-Za-z0-9+/]+=*$/.test(value);
  if (!isLikelyEncrypted) return value;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(value, 'base64');
      return safeStorage.decryptString(buf);
    }
  } catch { /* decryption failed */ }
  return value;
}

/* ── Read path ── */

function readModelConfig(): ModelConfig {
  const keysDir = getKeysDir();
  if (!existsSync(keysDir)) {
    // Try migration from old profiles
    const migrated = migrateFromProfiles();
    if (migrated) return migrated;
    return { ...DEFAULT_MODEL_CONFIG };
  }

  const files = readdirSync(keysDir).filter((f) => f.endsWith('.yaml'));
  const keys: ApiKeyEntry[] = [];

  for (const file of files) {
    const entry = readKeyFile(path.join(keysDir, file));
    if (entry) keys.push(entry);
  }

  return { keys };
}

function readKeyFile(filePath: string): ApiKeyEntry | null {
  try {
    const raw = parseFlatYaml(readFileSync(filePath, 'utf-8'));
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!id) return null;

    const name = typeof raw.name === 'string' ? raw.name : id;
    const baseUrl = typeof raw.baseUrl === 'string' ? raw.baseUrl : '';
    const apiKey = typeof raw.apiKey === 'string' ? decrypt(raw.apiKey) : '';

    const models: ApiKeyEntry['models'] = [];
    for (let i = 0; ; i++) {
      const modelId = raw[`models.${i}.id`];
      if (typeof modelId !== 'string' || !modelId) break;
      models.push({
        id: modelId,
        capability: readCapability(raw[`models.${i}.capability`]),
        alias: typeof raw[`models.${i}.alias`] === 'string' ? raw[`models.${i}.alias`] as string : modelId,
        enabled: raw[`models.${i}.enabled`] === true || raw[`models.${i}.enabled`] === 'true',
      });
    }

    return { id, name, baseUrl, apiKey, models };
  } catch {
    return null;
  }
}

function readCapability(value: unknown): 'text' | 'image' | 'video' {
  if (value === 'image' || value === 'video') return value;
  return 'text';
}

/* ── Write path ── */

function writeModelConfig(config: ModelConfig): void {
  const keysDir = getKeysDir();
  if (!existsSync(keysDir)) mkdirSync(keysDir, { recursive: true });

  const validIds = new Set(config.keys.map((k) => k.id));

  // Remove deleted keys
  for (const file of readdirSync(keysDir).filter((f) => f.endsWith('.yaml'))) {
    const id = file.replace(/\.yaml$/, '');
    if (!validIds.has(id)) rmSync(path.join(keysDir, file), { force: true });
  }

  // Write each key
  for (const key of config.keys) {
    const flat: Record<string, string | number | boolean | null> = {
      id: key.id,
      name: key.name,
      baseUrl: key.baseUrl,
      apiKey: encrypt(key.apiKey),
    };
    key.models.forEach((model, i) => {
      flat[`models.${i}.id`] = model.id;
      flat[`models.${i}.capability`] = model.capability;
      flat[`models.${i}.alias`] = model.alias;
      flat[`models.${i}.enabled`] = model.enabled;
    });
    writeFileSync(path.join(keysDir, `${key.id}.yaml`), stringifyFlatYaml(flat), 'utf-8');
  }
}

/* ── Migration from old profile-based config ── */

function migrateFromProfiles(): ModelConfig | null {
  const profilesDir = path.join(getModelDir(), 'profiles');
  if (!existsSync(profilesDir)) return null;

  const files = readdirSync(profilesDir).filter((f) => f.endsWith('.yaml'));
  if (files.length === 0) return null;

  const keys: ApiKeyEntry[] = [];
  for (const file of files) {
    try {
      const raw = parseFlatYaml(readFileSync(path.join(profilesDir, file), 'utf-8'));
      const id = typeof raw.id === 'string' ? raw.id.trim() : '';
      if (!id) continue;

      const name = typeof raw.name === 'string' ? raw.name : id;
      const baseUrl = typeof raw.baseUrl === 'string' ? raw.baseUrl : '';
      const apiKey = typeof raw.apiKey === 'string' ? decrypt(raw.apiKey) : '';

      const models: ApiKeyEntry['models'] = [];
      for (let i = 0; ; i++) {
        const modelId = raw[`models.${i}.id`];
        if (typeof modelId !== 'string' || !modelId) break;
        const cap = raw[`models.${i}.capabilities`];
        const capability = typeof cap === 'string' && cap.includes('image') ? 'image' as const
          : typeof cap === 'string' && cap.includes('video') ? 'video' as const
          : 'text' as const;
        const alias = typeof raw[`models.${i}.alias`] === 'string' ? raw[`models.${i}.alias`] as string : modelId;
        models.push({ id: modelId, capability, alias, enabled: true });
      }

      if (models.length > 0) keys.push({ id, name, baseUrl, apiKey, models });
    } catch { /* skip broken files */ }
  }

  if (keys.length === 0) return null;

  const config: ModelConfig = { keys };
  writeModelConfig(config);
  return config;
}

/* ── User preferences ── */

function readUserPreferences(): UserPreferencesConfig {
  try {
    const p = getUserPreferencesPath();
    if (!existsSync(p)) return { ...DEFAULT_USER_PREFERENCES };
    const raw = parseFlatYaml(readFileSync(p, 'utf-8')) as Record<string, unknown>;
    return {
      theme: typeof raw?.theme === 'string' ? raw.theme : DEFAULT_USER_PREFERENCES.theme,
      locale: typeof raw?.locale === 'string' ? raw.locale : DEFAULT_USER_PREFERENCES.locale,
      autoApplyPatches:
        typeof raw?.autoApplyPatches === 'boolean'
          ? raw.autoApplyPatches
          : DEFAULT_USER_PREFERENCES.autoApplyPatches,
      updateManifestUrl:
        typeof raw?.updateManifestUrl === 'string' && raw.updateManifestUrl.length > 0
          ? raw.updateManifestUrl
          : undefined,
    };
  } catch {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

function writeUserPreferences(config: UserPreferencesConfig): void {
  const p = getUserPreferencesPath();
  const dir = path.dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const flat: Record<string, string | number | boolean | null> = {
    theme: config.theme,
    locale: config.locale,
    autoApplyPatches: config.autoApplyPatches,
  };
  if (config.updateManifestUrl) flat.updateManifestUrl = config.updateManifestUrl;
  writeFileSync(p, stringifyFlatYaml(flat), 'utf-8');
}

export function readUserPreferencesFromDisk(): UserPreferencesConfig {
  return readUserPreferences();
}

/* ── Resolver helpers reused by gateway / story-sync IPC ── */

export function readModelConfigFromDisk(): ModelConfig {
  return readModelConfig();
}

export function getModelDirForTest(): string {
  return getModelDir();
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
