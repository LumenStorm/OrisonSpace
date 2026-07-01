import type { StateCreator } from 'zustand';
import type { ThemeSetting, LocaleSetting } from './types';
import { detectSystemLocale, availableLocales } from '../i18n/useI18n';
import type { UserPreferencesConfig } from '@orison/shared-contracts';
import type { ModelConfig } from '@orison/shared-contracts';
import { injectImportedFonts } from '../components/settings/fonts';

const DEFAULT_MODEL_CONFIG: ModelConfig = { keys: [] };

const DEFAULT_USER_PREFERENCES: UserPreferencesConfig = {
  theme: 'system',
  locale: 'system',
  autoApplyPatches: true,
  autoCheckUpdates: true,
  readingFontWeight: 400,
  readingFontScale: 1,
};

/** Empty string = follow the built-in default (--font-display). */
const DEFAULT_READING_FONT_FAMILY = '';
const DEFAULT_READING_FONT_WEIGHT = 400;
const DEFAULT_READING_FONT_SCALE = 1;

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
  /** Reading font family for editor + agent panel body. '' = built-in default. */
  readingFontFamily: string;
  setReadingFontFamily: (value: string) => void;
  /** Reading font weight for editor + agent panel body. */
  readingFontWeight: number;
  setReadingFontWeight: (value: number) => void;
  /** Reading font scale multiplier for editor + agent panel body. */
  readingFontScale: number;
  setReadingFontScale: (value: number) => void;
  /** Application version, populated at bootstrap via preload. Empty until loaded. */
  appVersion: string;
  loadAppVersion: () => Promise<void>;
  /** Whether to silently check for updates on startup. */
  autoCheckUpdates: boolean;
  setAutoCheckUpdates: (value: boolean) => void;

  // ── Writing settings ──
  chapterPrefix: string;
  setChapterPrefix: (value: string) => void;
  paragraphIndent: boolean;
  setParagraphIndent: (value: boolean) => void;
  showWordCount: boolean;
  setShowWordCount: (value: boolean) => void;

  // ── Appearance settings ──
  editorLineHeight: number;
  setEditorLineHeight: (value: number) => void;

  // ── Agent settings ──
  agentSessionRetention: number;
  setAgentSessionRetention: (value: number) => void;
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

/**
 * Reading typography only affects editor + agent panel body text. These CSS vars
 * are consumed by `.tiptap-content .tiptap`, `.agent-msg-md`, `.agent-message-content`.
 * Defaults leave the built-in look untouched (zero visual shift).
 */
function applyReadingFont(family: string, weight: number, scale: number) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  if (family && family.trim()) {
    root.setProperty('--reading-font-family', family.trim());
  } else {
    root.removeProperty('--reading-font-family');
  }
  root.setProperty('--reading-font-weight', String(weight || DEFAULT_READING_FONT_WEIGHT));
  root.setProperty('--reading-font-scale', String(scale || DEFAULT_READING_FONT_SCALE));
}

// Apply theme on load
applyTheme(DEFAULT_USER_PREFERENCES.theme as ThemeSetting);

function applyEditorLineHeight(lineHeight: number) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--editor-line-height', String(lineHeight));
}

function saveUserPreferencesSnapshot(config: UserPreferencesConfig): void {
  window.orisonDesktop?.saveUserPreferences?.(config).catch(() => {});
}

function buildPrefs(get: () => SettingsSlice, overrides: Partial<UserPreferencesConfig> = {}): UserPreferencesConfig {
  const s = get();
  const base: UserPreferencesConfig = {
    theme: s.theme,
    locale: s.locale,
    autoApplyPatches: s.autoApplyPatches,
    autoCheckUpdates: s.autoCheckUpdates,
    readingFontWeight: s.readingFontWeight,
    readingFontScale: s.readingFontScale,
    chapterPrefix: s.chapterPrefix,
    paragraphIndent: s.paragraphIndent,
    showWordCount: s.showWordCount,
    editorLineHeight: s.editorLineHeight,
    agentSessionRetention: s.agentSessionRetention,
  };
  if (s.readingFontFamily) base.readingFontFamily = s.readingFontFamily;
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
      const readingFontFamily = config.readingFontFamily ?? DEFAULT_READING_FONT_FAMILY;
      const readingFontWeight = config.readingFontWeight ?? DEFAULT_READING_FONT_WEIGHT;
      const readingFontScale = config.readingFontScale ?? DEFAULT_READING_FONT_SCALE;
      const editorLineHeight = config.editorLineHeight ?? 1.75;
      applyTheme(theme);
      applyReadingFont(readingFontFamily, readingFontWeight, readingFontScale);
      applyEditorLineHeight(editorLineHeight);
      window.orisonDesktop
        ?.listImportedFonts?.()
        .then((fonts) => injectImportedFonts(fonts))
        .catch(() => {});
      set({
        theme,
        locale,
        resolvedLocale: resolveLocale(locale),
        autoApplyPatches: config.autoApplyPatches,
        autoCheckUpdates: config.autoCheckUpdates ?? true,
        readingFontFamily,
        readingFontWeight,
        readingFontScale,
        chapterPrefix: config.chapterPrefix ?? 'ch-',
        paragraphIndent: config.paragraphIndent ?? true,
        showWordCount: config.showWordCount ?? true,
        editorLineHeight,
        agentSessionRetention: config.agentSessionRetention ?? 50,
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

  readingFontFamily: DEFAULT_READING_FONT_FAMILY,
  setReadingFontFamily(value) {
    const next = value.trim();
    applyReadingFont(next, get().readingFontWeight, get().readingFontScale);
    set({ readingFontFamily: next });
    saveUserPreferencesSnapshot(buildPrefs(get, { readingFontFamily: next || undefined }));
  },

  readingFontWeight: DEFAULT_READING_FONT_WEIGHT,
  setReadingFontWeight(value) {
    applyReadingFont(get().readingFontFamily, value, get().readingFontScale);
    set({ readingFontWeight: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { readingFontWeight: value }));
  },

  readingFontScale: DEFAULT_READING_FONT_SCALE,
  setReadingFontScale(value) {
    applyReadingFont(get().readingFontFamily, get().readingFontWeight, value);
    set({ readingFontScale: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { readingFontScale: value }));
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

  autoCheckUpdates: true,
  setAutoCheckUpdates(value) {
    set({ autoCheckUpdates: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { autoCheckUpdates: value }));
  },

  // ── Writing settings ──
  chapterPrefix: 'ch-',
  setChapterPrefix(value) {
    set({ chapterPrefix: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { chapterPrefix: value }));
  },
  paragraphIndent: true,
  setParagraphIndent(value) {
    set({ paragraphIndent: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { paragraphIndent: value }));
  },
  showWordCount: true,
  setShowWordCount(value) {
    set({ showWordCount: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { showWordCount: value }));
  },

  // ── Appearance settings ──
  editorLineHeight: 1.75,
  setEditorLineHeight(value) {
    applyEditorLineHeight(value);
    set({ editorLineHeight: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { editorLineHeight: value }));
  },

  // ── Agent settings ──
  agentSessionRetention: 50,
  setAgentSessionRetention(value) {
    set({ agentSessionRetention: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { agentSessionRetention: value }));
  },
});
