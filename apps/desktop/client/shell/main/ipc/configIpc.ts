import { app, dialog, ipcMain, safeStorage } from 'electron';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type {
  ApiKeyEntry,
  ImportedFont,
  ModelConfig,
  ModelProtocol,
  UserPreferencesConfig,
} from '@orison/shared-contracts';
import { parseFlatYaml, stringifyFlatYaml, modelConfigSaveSchema, DEFAULT_USER_PREFERENCES } from '@orison/shared-contracts';
import { atomicWriteFileSync } from '@orison/shared-contracts/fs/atomicWrite';
import { getLogger } from '../logger';

const DEFAULT_MODEL_CONFIG: ModelConfig = { keys: [] };

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

/** True when the last write fell back to plaintext (no OS keyring). */
let plaintextKeyWarningLogged = false;

function encrypt(value: string): string {
  if (!value) return '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(value).toString('base64');
    }
  } catch { /* fall through */ }
  // No keyring (common on some Linux setups): store plaintext but warn once so
  // operators know API keys sit unencrypted under ~/.orison/model/keys/.
  if (!plaintextKeyWarningLogged) {
    plaintextKeyWarningLogged = true;
    getLogger().warn(
      'safeStorage encryption unavailable — API keys will be stored in plaintext under ~/.orison/model/keys/',
    );
  }
  return value;
}

/** Whether OS-level secret encryption is available (for UI warnings). */
export function isApiKeyEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
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

function redactModelConfig(config: ModelConfig): ModelConfig {
  return {
    keys: config.keys.map((key) => ({
      ...key,
      apiKey: '',
    })),
  };
}

function readKeyFile(filePath: string): ApiKeyEntry | null {
  try {
    const raw = parseFlatYaml(readFileSync(filePath, 'utf-8'));
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!id) return null;

    const name = typeof raw.name === 'string' ? raw.name : id;
    const protocol = readProtocol(raw.protocol);
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

    return { id, name, protocol, baseUrl, apiKey, models };
  } catch {
    return null;
  }
}

function readProtocol(value: unknown): ModelProtocol {
  return value === 'anthropic-compatible' ? 'anthropic-compatible' : 'openai-compatible';
}

function readCapability(value: unknown): 'text' | 'image' | 'video' {
  if (value === 'image' || value === 'video') return value;
  return 'text';
}

/* ── Write path ── */

function writeModelConfig(config: ModelConfig): void {
  const keysDir = getKeysDir();
  if (!existsSync(keysDir)) mkdirSync(keysDir, { recursive: true });
  const existing = readModelConfig();
  const existingById = new Map(existing.keys.map((key) => [key.id, key]));

  const validIds = new Set(config.keys.map((k) => k.id));

  // Remove deleted keys
  for (const file of readdirSync(keysDir).filter((f) => f.endsWith('.yaml'))) {
    const id = file.replace(/\.yaml$/, '');
    if (!validIds.has(id)) rmSync(path.join(keysDir, file), { force: true });
  }

  // Write each key
  for (const key of config.keys) {
    const apiKey = key.apiKey || existingById.get(key.id)?.apiKey || '';
    const flat: Record<string, string | number | boolean | null> = {
      id: key.id,
      name: key.name,
      protocol: key.protocol,
      baseUrl: key.baseUrl,
      apiKey: encrypt(apiKey),
    };
    key.models.forEach((model, i) => {
      flat[`models.${i}.id`] = model.id;
      flat[`models.${i}.capability`] = model.capability;
      flat[`models.${i}.alias`] = model.alias;
      flat[`models.${i}.enabled`] = model.enabled;
    });
    atomicWriteFileSync(path.join(keysDir, `${key.id}.yaml`), stringifyFlatYaml(flat), 'utf-8');
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
      const protocol = readProtocol(raw.protocol);
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

      if (models.length > 0) keys.push({ id, name, protocol, baseUrl, apiKey, models });
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
      autoCheckUpdates:
        typeof raw?.autoCheckUpdates === 'boolean'
          ? raw.autoCheckUpdates
          : DEFAULT_USER_PREFERENCES.autoCheckUpdates,
      updateManifestUrl:
        typeof raw?.updateManifestUrl === 'string' && raw.updateManifestUrl.length > 0
          ? raw.updateManifestUrl
          : undefined,
      readingFontFamily:
        typeof raw?.readingFontFamily === 'string' && raw.readingFontFamily.length > 0
          ? raw.readingFontFamily
          : undefined,
      readingFontWeight:
        typeof raw?.readingFontWeight === 'number'
          ? raw.readingFontWeight
          : DEFAULT_USER_PREFERENCES.readingFontWeight,
      readingFontScale:
        typeof raw?.readingFontScale === 'number'
          ? raw.readingFontScale
          : DEFAULT_USER_PREFERENCES.readingFontScale,
      paragraphIndent:
        typeof raw?.paragraphIndent === 'boolean'
          ? raw.paragraphIndent
          : DEFAULT_USER_PREFERENCES.paragraphIndent,
      showWordCount:
        typeof raw?.showWordCount === 'boolean'
          ? raw.showWordCount
          : DEFAULT_USER_PREFERENCES.showWordCount,
      autoSaveEnabled:
        typeof raw?.autoSaveEnabled === 'boolean'
          ? raw.autoSaveEnabled
          : DEFAULT_USER_PREFERENCES.autoSaveEnabled,
      autoSaveInterval:
        typeof raw?.autoSaveInterval === 'number'
          ? raw.autoSaveInterval
          : DEFAULT_USER_PREFERENCES.autoSaveInterval,
      spellCheck:
        typeof raw?.spellCheck === 'boolean'
          ? raw.spellCheck
          : DEFAULT_USER_PREFERENCES.spellCheck,
      wordCountGoal:
        typeof raw?.wordCountGoal === 'number'
          ? raw.wordCountGoal
          : DEFAULT_USER_PREFERENCES.wordCountGoal,
      editorLineHeight:
        typeof raw?.editorLineHeight === 'number'
          ? raw.editorLineHeight
          : DEFAULT_USER_PREFERENCES.editorLineHeight,
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
    autoCheckUpdates: config.autoCheckUpdates ?? true,
  };
  if (config.updateManifestUrl) flat.updateManifestUrl = config.updateManifestUrl;
  if (config.readingFontFamily) flat.readingFontFamily = config.readingFontFamily;
  if (typeof config.readingFontWeight === 'number') flat.readingFontWeight = config.readingFontWeight;
  if (typeof config.readingFontScale === 'number') flat.readingFontScale = config.readingFontScale;
  if (typeof config.paragraphIndent === 'boolean') flat.paragraphIndent = config.paragraphIndent;
  if (typeof config.showWordCount === 'boolean') flat.showWordCount = config.showWordCount;
  if (typeof config.autoSaveEnabled === 'boolean') flat.autoSaveEnabled = config.autoSaveEnabled;
  if (typeof config.autoSaveInterval === 'number') flat.autoSaveInterval = config.autoSaveInterval;
  if (typeof config.spellCheck === 'boolean') flat.spellCheck = config.spellCheck;
  if (typeof config.wordCountGoal === 'number') flat.wordCountGoal = config.wordCountGoal;
  if (typeof config.editorLineHeight === 'number') flat.editorLineHeight = config.editorLineHeight;
  atomicWriteFileSync(p, stringifyFlatYaml(flat), 'utf-8');
}

export function readUserPreferencesFromDisk(): UserPreferencesConfig {
  return readUserPreferences();
}

/* ── Imported fonts ── */

const FONT_EXTENSIONS = ['.ttf', '.otf', '.ttc', '.woff', '.woff2'];
const FONT_MIME: Record<string, string> = {
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.ttc': 'font/collection',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function getFontsDir(): string {
  return path.join(app.getPath('userData'), 'fonts');
}

/** Build an ImportedFont from a file on disk, or null if unreadable. */
function readImportedFont(file: string): ImportedFont | null {
  try {
    const ext = path.extname(file).toLowerCase();
    const mime = FONT_MIME[ext] ?? 'application/octet-stream';
    const base64 = readFileSync(file).toString('base64');
    return {
      family: path.basename(file, path.extname(file)),
      dataUrl: `data:${mime};base64,${base64}`,
    };
  } catch {
    return null;
  }
}

/** Enumerate fonts the user has imported into userData/fonts. */
function listImportedFonts(): ImportedFont[] {
  const dir = getFontsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => FONT_EXTENSIONS.includes(path.extname(name).toLowerCase()))
    .map((name) => readImportedFont(path.join(dir, name)))
    .filter((f): f is ImportedFont => f !== null)
    .sort((a, b) => a.family.localeCompare(b.family));
}

/** Open a file picker, copy chosen font files into userData/fonts, return the full list. */
async function importFonts(): Promise<ImportedFont[]> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Fonts', extensions: FONT_EXTENSIONS.map((e) => e.slice(1)) }],
  });
  if (result.canceled) return listImportedFonts();
  const dir = getFontsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  for (const src of result.filePaths) {
    const ext = path.extname(src).toLowerCase();
    if (!FONT_EXTENSIONS.includes(ext)) continue;
    try {
      copyFileSync(src, path.join(dir, path.basename(src)));
    } catch {
      // Skip files that can't be copied; the rest still import.
    }
  }
  return listImportedFonts();
}

/* ── Resolver helpers reused by gateway / story-sync IPC ── */

export function readModelConfigFromDisk(): ModelConfig {
  return readModelConfig();
}

function _getModelDirForTest(): string {
  return getModelDir();
}

export function registerConfigIpc() {
  ipcMain.handle('config:load-model', () => redactModelConfig(readModelConfig()));
  ipcMain.handle('config:save-model', (_, config: ModelConfig) => {
    writeModelConfig(modelConfigSaveSchema.parse(config));
  });
  ipcMain.handle('config:is-key-encryption-available', () => isApiKeyEncryptionAvailable());
  ipcMain.handle('config:load-user-preferences', () => readUserPreferences());
  ipcMain.handle('config:save-user-preferences', (_, config: UserPreferencesConfig) => {
    writeUserPreferences(config);
  });
  ipcMain.handle('config:list-imported-fonts', () => listImportedFonts());
  ipcMain.handle('config:import-fonts', () => importFonts());
}
