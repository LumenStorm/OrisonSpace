import type { StateCreator } from 'zustand';
import type { ThemeSetting, LocaleSetting } from './types';
import { storage } from './storage';
import { detectSystemLocale, availableLocales } from '../i18n/useI18n';

export type ModelConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-5.4'
};

export type SettingsSlice = {
  theme: ThemeSetting;
  setTheme: (theme: ThemeSetting) => void;
  locale: LocaleSetting;
  resolvedLocale: string;
  setLocale: (locale: LocaleSetting) => void;
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig) => void;
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

const savedTheme = (storage.getString('theme', 'system')) as ThemeSetting;
const savedLocale = (storage.getString('locale', 'system')) as LocaleSetting;
const savedAutoApply = storage.get<boolean>('autoApplyPatches', true);

// Apply theme on load
applyTheme(savedTheme);

export const createSettingsSlice: StateCreator<SettingsSlice, [], [], SettingsSlice> = (set) => ({
  theme: savedTheme,
  setTheme(theme) {
    storage.set('theme', theme);
    applyTheme(theme);
    set({ theme });
  },

  locale: savedLocale,
  resolvedLocale: resolveLocale(savedLocale),
  setLocale(locale) {
    storage.set('locale', locale);
    set({ locale, resolvedLocale: resolveLocale(locale) });
  },

  modelConfig: { ...DEFAULT_MODEL_CONFIG },
  setModelConfig(config) {
    set({ modelConfig: config });
    if (window.orisonDesktop?.saveModelConfig) {
      window.orisonDesktop.saveModelConfig(config).catch(() => {});
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

  autoApplyPatches: savedAutoApply,
  setAutoApplyPatches(value) {
    storage.set('autoApplyPatches', value);
    set({ autoApplyPatches: value });
  },
});
