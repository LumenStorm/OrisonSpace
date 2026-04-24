import type { StateCreator } from 'zustand';
import type { ThemeSetting, LocaleSetting } from './types';
import { storage } from './storage';
import { detectSystemLocale, availableLocales } from '../i18n/useI18n';

export type SettingsSlice = {
  theme: ThemeSetting;
  setTheme: (theme: ThemeSetting) => void;
  locale: LocaleSetting;
  resolvedLocale: string;
  setLocale: (locale: LocaleSetting) => void;
};

function resolveLocale(locale: LocaleSetting): string {
  if (locale === 'system') return detectSystemLocale();
  if (availableLocales.includes(locale)) return locale;
  return 'en-US';
}

function applyTheme(theme: ThemeSetting) {
  document.documentElement.dataset.theme = theme;
}

const savedTheme = (storage.getString('theme', 'system')) as ThemeSetting;
const savedLocale = (storage.getString('locale', 'system')) as LocaleSetting;

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
});
