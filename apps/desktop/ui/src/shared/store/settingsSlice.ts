import type { StateCreator } from 'zustand';
import type { ThemeSetting, LocaleSetting } from './types';
import { detectSystemLocale, availableLocales } from '../i18n/useI18n';
import type { UserPreferencesConfig } from '@orison/shared-contracts';
import type { ModelConfig } from '@orison/shared-contracts';

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

export const createSettingsSlice: StateCreator<SettingsSlice, [], [], SettingsSlice> = (set, get) => ({
  theme: DEFAULT_USER_PREFERENCES.theme as ThemeSetting,
  setTheme(theme) {
    applyTheme(theme);
    set({ theme });
    saveUserPreferencesSnapshot({
      theme,
      locale: get().locale,
      autoApplyPatches: get().autoApplyPatches,
    });
  },

  locale: DEFAULT_USER_PREFERENCES.locale as LocaleSetting,
  resolvedLocale: resolveLocale(DEFAULT_USER_PREFERENCES.locale),
  setLocale(locale) {
    set({ locale, resolvedLocale: resolveLocale(locale) });
    saveUserPreferencesSnapshot({
      theme: get().theme,
      locale,
      autoApplyPatches: get().autoApplyPatches,
    });
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
    saveUserPreferencesSnapshot({
      theme: get().theme,
      locale: get().locale,
      autoApplyPatches: value,
    });
  },
});
