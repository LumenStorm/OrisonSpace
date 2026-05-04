import { ipcMain, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ModelConfig, ModelProfile, ModelSlotConfig, ModelType, UserPreferencesConfig } from '@orison/shared-contracts';
import { parseFlatYaml, stringifyFlatYaml } from '@orison/shared-contracts';

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  profiles: [],
  selected: {
    novel: null,
    image: null,
    video: null,
  },
};

const DEFAULT_USER_PREFERENCES: UserPreferencesConfig = {
  theme: 'system',
  locale: 'system',
  autoApplyPatches: true
};

let modelDirOverride: string | null = null;

export function _setModelConfigDirForTest(dir: string | null) {
  modelDirOverride = dir;
}

function getModelDir(): string {
  return modelDirOverride ?? path.join(os.homedir(), '.orison', 'model');
}

function getModelConfigPath(): string {
  return path.join(getModelDir(), 'config.yaml');
}

function getModelIndexPath(): string {
  return path.join(getModelDir(), 'index.yaml');
}

function getModelProfilesDir(): string {
  return path.join(getModelDir(), 'profiles');
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
  const indexPath = getModelIndexPath();
  try {
    if (existsSync(indexPath)) return readProfileModelConfig(indexPath);
  } catch {
    return { ...DEFAULT_MODEL_CONFIG };
  }

  const p = getModelConfigPath();
  try {
    if (!existsSync(p)) return { ...DEFAULT_MODEL_CONFIG };
    const raw = parseFlatYaml(readFileSync(p, 'utf-8'));
    return migrateLegacyModelConfig(raw);
  } catch {
    return { ...DEFAULT_MODEL_CONFIG };
  }
}

function readProfileModelConfig(indexPath: string): ModelConfig {
  const raw = parseFlatYaml(readFileSync(indexPath, 'utf-8'));
  const profileDir = getModelProfilesDir();
  const order = readCsv(raw.order).filter((id) => isSafeProfileId(id));
  const files = existsSync(profileDir)
    ? readdirSync(profileDir).filter((file) => file.endsWith('.yaml'))
    : [];
  const byId = new Map<string, ModelProfile>();

  for (const file of files) {
    const profile = readModelProfile(path.join(profileDir, file));
    if (profile) byId.set(profile.id, profile);
  }

  const orderedProfiles = [
    ...order.map((id) => byId.get(id)).filter((profile): profile is ModelProfile => Boolean(profile)),
    ...[...byId.values()].filter((profile) => !order.includes(profile.id)),
  ];

  return {
    profiles: orderedProfiles,
    selected: {
      novel: readSelectedId(raw['selected.novel'], byId),
      image: readSelectedId(raw['selected.image'], byId),
      video: readSelectedId(raw['selected.video'], byId),
    },
  };
}

function readModelProfile(filePath: string): ModelProfile | null {
  try {
    const raw = parseFlatYaml(readFileSync(filePath, 'utf-8'));
    const id = readString(raw.id, '').trim();
    if (!isSafeProfileId(id)) return null;

    return {
      id,
      name: readString(raw.name, id),
      provider: readProvider(raw.provider, 'openai'),
      apiKey: typeof raw.apiKey === 'string' ? decrypt(raw.apiKey) : '',
      baseUrl: readString(raw.baseUrl, 'https://api.openai.com/v1'),
      model: readString(raw.model, ''),
      capabilities: readCapabilities(raw.capabilities),
    };
  } catch {
    return null;
  }
}

function migrateLegacyModelConfig(raw: Record<string, unknown>): ModelConfig {
  const selected: ModelConfig['selected'] = { novel: null, image: null, video: null };
  const profiles: ModelProfile[] = [];

  for (const type of ['novel', 'image', 'video'] as const) {
    const slot = readLegacyModelSlot(raw, type);
    if (!slot.apiKey && !slot.model && slot.baseUrl === 'https://api.openai.com/v1') continue;

    const id = `model_${String(profiles.length + 1).padStart(3, '0')}`;
    profiles.push({
      id,
      name: buildLegacyProfileName(type, slot),
      provider: slot.provider,
      apiKey: slot.apiKey,
      baseUrl: slot.baseUrl,
      model: slot.model,
      capabilities: [modelTypeCapability(type)],
    });
    selected[type] = id;
  }

  return { profiles, selected };
}

function readLegacyModelSlot(raw: Record<string, unknown>, type: ModelType): ModelSlotConfig {
  const fallback: ModelSlotConfig = { provider: 'openai', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: '' };
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

function readProvider(value: unknown, fallback: ModelSlotConfig['provider']) {
  return value === 'gcp' || value === 'anthropic' || value === 'openai' ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readCsv(value: unknown): string[] {
  return typeof value === 'string'
    ? value.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
}

function readCapabilities(value: unknown): ModelProfile['capabilities'] {
  const parsed = readCsv(value).filter((item): item is ModelProfile['capabilities'][number] =>
    item === 'text' || item === 'image' || item === 'video'
  );
  return parsed.length > 0 ? parsed : ['text'];
}

function readSelectedId(value: unknown, profiles: Map<string, ModelProfile>): string | null {
  if (typeof value !== 'string') return null;
  return profiles.has(value) ? value : null;
}

function isSafeProfileId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id);
}

function modelTypeCapability(type: ModelType): ModelProfile['capabilities'][number] {
  if (type === 'image') return 'image';
  if (type === 'video') return 'video';
  return 'text';
}

function buildLegacyProfileName(type: ModelType, slot: ModelSlotConfig): string {
  const model = slot.model || slot.provider;
  if (type === 'novel') return `Novel ${model}`;
  if (type === 'image') return `Image ${model}`;
  return `Video ${model}`;
}

function nextProfileId(existing: Set<string>): string {
  let index = 1;
  while (existing.has(`model_${String(index).padStart(3, '0')}`)) index += 1;
  return `model_${String(index).padStart(3, '0')}`;
}

function writeModelConfig(config: ModelConfig): void {
  const modelDir = path.dirname(getModelIndexPath());
  const profileDir = getModelProfilesDir();
  if (!existsSync(modelDir)) mkdirSync(modelDir, { recursive: true });
  if (!existsSync(profileDir)) mkdirSync(profileDir, { recursive: true });

  const seen = new Set<string>();
  const profiles = config.profiles.map((profile) => {
    const id = isSafeProfileId(profile.id) && !seen.has(profile.id)
      ? profile.id
      : nextProfileId(seen);
    seen.add(id);
    return { ...profile, id };
  });
  const profileIds = new Set(profiles.map((profile) => profile.id));
  const selected = {
    novel: profileIds.has(config.selected.novel ?? '') ? config.selected.novel : null,
    image: profileIds.has(config.selected.image ?? '') ? config.selected.image : null,
    video: profileIds.has(config.selected.video ?? '') ? config.selected.video : null,
  };

  for (const file of readdirSync(profileDir).filter((item) => item.endsWith('.yaml'))) {
    const id = file.replace(/\.yaml$/, '');
    if (!profileIds.has(id)) rmSync(path.join(profileDir, file), { force: true });
  }

  for (const profile of profiles) {
    writeFileSync(
      path.join(profileDir, `${profile.id}.yaml`),
      stringifyFlatYaml({
        id: profile.id,
        name: profile.name,
        provider: profile.provider,
        apiKey: encrypt(profile.apiKey),
        baseUrl: profile.baseUrl,
        model: profile.model,
        capabilities: profile.capabilities.join(','),
      }),
      'utf-8',
    );
  }

  writeFileSync(
    getModelIndexPath(),
    stringifyFlatYaml({
      version: 2,
      order: profiles.map((profile) => profile.id).join(','),
      'selected.novel': selected.novel,
      'selected.image': selected.image,
      'selected.video': selected.video,
    }),
    'utf-8',
  );
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
