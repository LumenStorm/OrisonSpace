import { ipcMain, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type {
  GenerationProvider,
  ModelApiFormat,
  ModelCapability,
  ModelConfig,
  ModelEntry,
  ModelProfile,
  ModelType,
  SlotAssignment,
  UserPreferencesConfig,
} from '@orison/shared-contracts';
import { parseFlatYaml, stringifyFlatYaml } from '@orison/shared-contracts';
import { apiFormats, inferApiFormat } from '@orison/model-protocols';

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
  autoApplyPatches: true,
};

let modelDirOverride: string | null = null;

export function _setModelConfigDirForTest(dir: string | null) {
  modelDirOverride = dir;
}

function getModelDir(): string {
  return modelDirOverride ?? path.join(os.homedir(), '.orison', 'model');
}

function getLegacyModelConfigPath(): string {
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
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(value, 'base64');
      return safeStorage.decryptString(buf);
    }
  } catch { /* fall through */ }
  return value;
}

/* ── Read path ── */

function readModelConfig(): ModelConfig {
  const indexPath = getModelIndexPath();
  if (existsSync(indexPath)) {
    try {
      return readProfileModelConfig(indexPath);
    } catch {
      return { ...DEFAULT_MODEL_CONFIG };
    }
  }

  const legacy = getLegacyModelConfigPath();
  try {
    if (!existsSync(legacy)) return { ...DEFAULT_MODEL_CONFIG };
    const raw = parseFlatYaml(readFileSync(legacy, 'utf-8'));
    return migrateLegacyConfigYaml(raw);
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
    const profile = readModelProfileFile(path.join(profileDir, file));
    if (profile) byId.set(profile.id, profile);
  }

  const orderedProfiles = [
    ...order.map((id) => byId.get(id)).filter((profile): profile is ModelProfile => Boolean(profile)),
    ...[...byId.values()].filter((profile) => !order.includes(profile.id)),
  ];

  const profileMap = new Map(orderedProfiles.map((p) => [p.id, p] as const));

  return {
    profiles: orderedProfiles,
    selected: {
      novel: readSelectedSlot(raw, 'novel', profileMap),
      image: readSelectedSlot(raw, 'image', profileMap),
      video: readSelectedSlot(raw, 'video', profileMap),
    },
  };
}

function readModelProfileFile(filePath: string): ModelProfile | null {
  try {
    const raw = parseFlatYaml(readFileSync(filePath, 'utf-8'));
    const id = readString(raw.id, '').trim();
    if (!isSafeProfileId(id)) return null;

    const provider = readProvider(raw.provider, 'openai');
    const baseUrl = readString(raw.baseUrl, 'https://api.openai.com/v1');
    const apiKey = typeof raw.apiKey === 'string' ? decrypt(raw.apiKey) : '';
    const name = readString(raw.name, id);
    const isV2 = raw.schemaVersion === 2 || hasIndexedKey(raw, 'models.0.id');

    const models: ModelEntry[] = isV2
      ? readV2Models(raw, provider)
      : readV1ModelAsList(raw, provider);

    if (models.length === 0) return null;

    return {
      schemaVersion: 2,
      id,
      name,
      provider,
      baseUrl,
      apiKey,
      models,
    };
  } catch {
    return null;
  }
}

function readV2Models(raw: Record<string, unknown>, provider: GenerationProvider): ModelEntry[] {
  const out: ModelEntry[] = [];
  for (let index = 0; ; index += 1) {
    const idKey = `models.${index}.id`;
    const id = raw[idKey];
    if (typeof id !== 'string' || !id) break;
    const alias = readString(raw[`models.${index}.alias`], id);
    const apiFormat = readApiFormat(raw[`models.${index}.apiFormat`], inferApiFormat(id, provider));
    const capabilities = readCapabilities(raw[`models.${index}.capabilities`]);
    out.push({ id, alias, apiFormat, capabilities });
  }
  return out;
}

function readV1ModelAsList(raw: Record<string, unknown>, provider: GenerationProvider): ModelEntry[] {
  const id = readString(raw.model, '');
  if (!id) return [];
  const apiFormat = readApiFormat(raw.apiFormat, inferApiFormat(id, provider));
  const capabilities = readCapabilities(raw.capabilities);
  return [
    {
      id,
      alias: id,
      apiFormat,
      capabilities,
    },
  ];
}

function readSelectedSlot(
  raw: Record<string, unknown>,
  slot: ModelType,
  profileMap: Map<string, ModelProfile>,
): SlotAssignment | null {
  const profileIdKey = `selected.${slot}.profileId`;
  const modelIdKey = `selected.${slot}.modelId`;
  const profileIdRaw = raw[profileIdKey];
  const modelIdRaw = raw[modelIdKey];
  if (typeof profileIdRaw === 'string' && typeof modelIdRaw === 'string') {
    const profile = profileMap.get(profileIdRaw);
    if (!profile) return null;
    if (!profile.models.some((m) => m.id === modelIdRaw)) return null;
    return { profileId: profileIdRaw, modelId: modelIdRaw };
  }

  // Legacy v1: `selected.<slot>: profileId` (string only).
  const legacy = raw[`selected.${slot}`];
  if (typeof legacy === 'string' && legacy && profileMap.has(legacy)) {
    const profile = profileMap.get(legacy);
    const firstModel = profile?.models[0];
    if (firstModel) return { profileId: legacy, modelId: firstModel.id };
  }
  return null;
}

/* ── Legacy `config.yaml` (single-model, pre-profile-files) ── */

function migrateLegacyConfigYaml(raw: Record<string, unknown>): ModelConfig {
  const profiles: ModelProfile[] = [];
  const selected: ModelConfig['selected'] = { novel: null, image: null, video: null };

  for (const slot of ['novel', 'image', 'video'] as const) {
    const provider = readProvider(raw[`${slot}.provider`] ?? (slot === 'novel' ? raw.provider : undefined), 'openai');
    const apiKey = readLegacyApiKey(raw, slot);
    const baseUrl = readString(
      raw[`${slot}.baseUrl`] ?? (slot === 'novel' ? raw.baseUrl : undefined),
      'https://api.openai.com/v1',
    );
    const model = readString(
      raw[`${slot}.model`] ??
        (slot === 'novel' ? raw.novelModel ?? raw.model : slot === 'image' ? raw.imageModel : raw.videoModel),
      '',
    );

    if (!apiKey && !model && baseUrl === 'https://api.openai.com/v1') continue;

    const id = `model_${String(profiles.length + 1).padStart(3, '0')}`;
    const apiFormat = inferApiFormat(model || 'gpt-4o', provider);
    const capability: ModelCapability = slot === 'image' ? 'image' : slot === 'video' ? 'video' : 'text';

    profiles.push({
      schemaVersion: 2,
      id,
      name: buildLegacyProfileName(slot, model || provider),
      provider,
      apiKey,
      baseUrl,
      models: [
        {
          id: model || `${provider}-default`,
          alias: model || `${provider} default`,
          apiFormat,
          capabilities: [capability],
        },
      ],
    });
    selected[slot] = { profileId: id, modelId: model || `${provider}-default` };
  }

  return { profiles, selected };
}

function readLegacyApiKey(raw: Record<string, unknown>, slot: ModelType): string {
  const encrypted = raw[`${slot}.apiKey`];
  const legacy = slot === 'novel' ? raw.apiKey : undefined;
  if (typeof encrypted === 'string') return decrypt(encrypted);
  if (typeof legacy === 'string') return decrypt(legacy);
  return '';
}

/* ── Write path (always v2) ── */

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

  const validateSlot = (slot: SlotAssignment | null): SlotAssignment | null => {
    if (!slot) return null;
    if (!profileIds.has(slot.profileId)) return null;
    const profile = profiles.find((p) => p.id === slot.profileId);
    if (!profile?.models.some((m) => m.id === slot.modelId)) return null;
    return slot;
  };

  const selected = {
    novel: validateSlot(config.selected.novel),
    image: validateSlot(config.selected.image),
    video: validateSlot(config.selected.video),
  };

  for (const file of readdirSync(profileDir).filter((item) => item.endsWith('.yaml'))) {
    const id = file.replace(/\.yaml$/, '');
    if (!profileIds.has(id)) rmSync(path.join(profileDir, file), { force: true });
  }

  for (const profile of profiles) {
    const flat: Record<string, string | number | boolean | null> = {
      schemaVersion: 2,
      id: profile.id,
      name: profile.name,
      provider: profile.provider,
      apiKey: encrypt(profile.apiKey),
      baseUrl: profile.baseUrl,
    };
    profile.models.forEach((model, index) => {
      flat[`models.${index}.id`] = model.id;
      flat[`models.${index}.alias`] = model.alias;
      flat[`models.${index}.apiFormat`] = model.apiFormat;
      flat[`models.${index}.capabilities`] = model.capabilities.join(',');
    });
    writeFileSync(path.join(profileDir, `${profile.id}.yaml`), stringifyFlatYaml(flat), 'utf-8');
  }

  const indexFlat: Record<string, string | number | boolean | null> = {
    version: 2,
    order: profiles.map((profile) => profile.id).join(','),
  };
  for (const slot of ['novel', 'image', 'video'] as const) {
    indexFlat[`selected.${slot}.profileId`] = selected[slot]?.profileId ?? null;
    indexFlat[`selected.${slot}.modelId`] = selected[slot]?.modelId ?? null;
  }
  writeFileSync(getModelIndexPath(), stringifyFlatYaml(indexFlat), 'utf-8');

  // Best-effort: drop the legacy single-file config if it still exists.
  const legacy = getLegacyModelConfigPath();
  if (existsSync(legacy)) {
    try { rmSync(legacy, { force: true }); } catch { /* non-fatal */ }
  }
}

/* ── Helpers ── */

function readProvider(value: unknown, fallback: GenerationProvider): GenerationProvider {
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

function readCapabilities(value: unknown): ModelCapability[] {
  const parsed = readCsv(value).filter(
    (item): item is ModelCapability => item === 'text' || item === 'image' || item === 'video',
  );
  return parsed.length > 0 ? parsed : ['text'];
}

function readApiFormat(value: unknown, fallback: ModelApiFormat): ModelApiFormat {
  if (typeof value === 'string' && (apiFormats as string[]).includes(value)) {
    return value as ModelApiFormat;
  }
  return fallback;
}

function hasIndexedKey(raw: Record<string, unknown>, key: string): boolean {
  return typeof raw[key] === 'string' && (raw[key] as string).length > 0;
}

function isSafeProfileId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id);
}

function nextProfileId(existing: Set<string>): string {
  let index = 1;
  while (existing.has(`model_${String(index).padStart(3, '0')}`)) index += 1;
  return `model_${String(index).padStart(3, '0')}`;
}

function buildLegacyProfileName(slot: ModelType, modelOrProvider: string): string {
  if (slot === 'novel') return `Novel ${modelOrProvider}`;
  if (slot === 'image') return `Image ${modelOrProvider}`;
  return `Video ${modelOrProvider}`;
}

/* ── User preferences (unchanged) ── */

function readUserPreferences(): UserPreferencesConfig {
  const p = getUserPreferencesPath();
  try {
    if (!existsSync(p)) return { ...DEFAULT_USER_PREFERENCES };
    const raw = parseFlatYaml(readFileSync(p, 'utf-8'));
    return {
      theme: typeof raw?.theme === 'string' ? raw.theme : DEFAULT_USER_PREFERENCES.theme,
      locale: typeof raw?.locale === 'string' ? raw.locale : DEFAULT_USER_PREFERENCES.locale,
      autoApplyPatches:
        typeof raw?.autoApplyPatches === 'boolean'
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
