import type { StateCreator } from 'zustand';
import type { ThemeSetting, LocaleSetting } from './types';
import { detectSystemLocale, availableLocales } from '../i18n/useI18n';
import type { UserPreferencesConfig } from '@orison/shared-contracts';
import type { ModelConfig } from '@orison/shared-contracts';

const DEFAULT_MODEL_CONFIG: ModelConfig = { keys: [] };

const DEFAULT_USER_PREFERENCES: UserPreferencesConfig = {
  theme: 'system',
  locale: 'system',
  autoApplyPatches: true
};

export type SettingsSlice = {
  theme: ThemeSetting;
  setTheme: (theme: ThemeSetting) => void;
  locale: LocaleSetting;
  resolvedLocale: string;
  setLocale: (locale: LocaleSetting) => void;
  loadUserPreferences: () => Promise<void>;
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig) => Promise<void>;
  loadModelConfig: () => Promise<void>;
  autoApplyPatches: boolean;
  setAutoApplyPatches: (value: boolean) => void;
  /** Application version, populated at bootstrap via preload. Empty until loaded. */
  appVersion: string;
  loadAppVersion: () => Promise<void>;
  /** URL to remote update manifest. Empty string means "not configured". */
  updateManifestUrl: string;
  setUpdateManifestUrl: (url: string) => void;
};

function resolveLocale(locale: LocaleSetting): string {
  if (locale === 'system') return detectSystemLocale();
  if (availableLocales.includes(locale)) return locale;
  return 'en-US';
}

function applyTheme(theme: ThemeSetting) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

// Apply theme on load
applyTheme(DEFAULT_USER_PREFERENCES.theme as ThemeSetting);

function saveUserPreferencesSnapshot(config: UserPreferencesConfig): void {
  window.orisonDesktop?.saveUserPreferences?.(config).catch(() => {});
}

function buildPrefs(get: () => SettingsSlice, overrides: Partial<UserPreferencesConfig> = {}): UserPreferencesConfig {
  const s = get();
  const base: UserPreferencesConfig = {
    theme: s.theme,
    locale: s.locale,
    autoApplyPatches: s.autoApplyPatches,
  };
  if (s.updateManifestUrl) base.updateManifestUrl = s.updateManifestUrl;
  return { ...base, ...overrides };
}

export const createSettingsSlice: StateCreator<SettingsSlice, [], [], SettingsSlice> = (set, get) => ({
  theme: DEFAULT_USER_PREFERENCES.theme as ThemeSetting,
  setTheme(theme) {
    applyTheme(theme);
    set({ theme });
    saveUserPreferencesSnapshot(buildPrefs(get, { theme }));
  },

  locale: DEFAULT_USER_PREFERENCES.locale as LocaleSetting,
  resolvedLocale: resolveLocale(DEFAULT_USER_PREFERENCES.locale),
  setLocale(locale) {
    set({ locale, resolvedLocale: resolveLocale(locale) });
    saveUserPreferencesSnapshot(buildPrefs(get, { locale }));
  },
  async loadUserPreferences() {
    if (!window.orisonDesktop?.loadUserPreferences) return;
    try {
      const config = await window.orisonDesktop.loadUserPreferences();
      const theme = config.theme as ThemeSetting;
      const locale = config.locale as LocaleSetting;
      applyTheme(theme);
      set({
        theme,
        locale,
        resolvedLocale: resolveLocale(locale),
        autoApplyPatches: config.autoApplyPatches,
        updateManifestUrl: config.updateManifestUrl ?? '',
      });
    } catch {
      // Keep defaults when preferences cannot be read.
    }
  },

  modelConfig: { ...DEFAULT_MODEL_CONFIG },
  async setModelConfig(config) {
    set({ modelConfig: config });
    if (window.orisonDesktop?.saveModelConfig) {
      await window.orisonDesktop.saveModelConfig(config);
    }
  },
  async loadModelConfig() {
    if (window.orisonDesktop?.loadModelConfig) {
      try {
        const config = await window.orisonDesktop.loadModelConfig();
        set({ modelConfig: config });
      } catch { /* 读取失败保持默认值 */ }
    }
  },

  autoApplyPatches: DEFAULT_USER_PREFERENCES.autoApplyPatches,
  setAutoApplyPatches(value) {
    set({ autoApplyPatches: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { autoApplyPatches: value }));
  },

  appVersion: '',
  async loadAppVersion() {
    if (!window.orisonDesktop?.getAppVersion) return;
    try {
      const version = await window.orisonDesktop.getAppVersion();
      set({ appVersion: version });
    } catch {
      // Keep empty version.
    }
  },

  updateManifestUrl: '',
  setUpdateManifestUrl(url) {
    const trimmed = url.trim();
    set({ updateManifestUrl: trimmed });
    saveUserPreferencesSnapshot(buildPrefs(get, { updateManifestUrl: trimmed || undefined }));
  },
});
