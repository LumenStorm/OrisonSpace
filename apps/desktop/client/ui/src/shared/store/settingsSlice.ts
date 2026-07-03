import type { StateCreator } from 'zustand';
import type { ThemeSetting, LocaleSetting } from './types';
import { detectSystemLocale, availableLocales } from '../i18n/useI18n';
import type { UserPreferencesConfig } from '@orison/shared-contracts';
import type { ModelConfig } from '@orison/shared-contracts';
import { DEFAULT_USER_PREFERENCES } from '@orison/shared-contracts';
import { injectImportedFonts } from '../components/settings/fonts';

const DEFAULT_MODEL_CONFIG: ModelConfig = { keys: [] };

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
  /** Persist the current preference snapshot. Use after mutating a preference
   *  owned by another slice (e.g. autoSaveEnabled in autoSaveSlice). */
  persistPreferences: () => void;
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
  paragraphIndent: boolean;
  setParagraphIndent: (value: boolean) => void;
  showWordCount: boolean;
  setShowWordCount: (value: boolean) => void;
  /** Auto-save debounce interval in ms. Consumed by useAutoSave. */
  autoSaveInterval: number;
  setAutoSaveInterval: (value: number) => void;
  /** Native browser spellcheck in the manuscript/code editors. */
  spellCheck: boolean;
  setSpellCheck: (value: boolean) => void;
  /** Target character count for the active document. 0 = no goal. */
  wordCountGoal: number;
  setWordCountGoal: (value: number) => void;

  // ── Appearance settings ──
  editorLineHeight: number;
  setEditorLineHeight: (value: number) => void;
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

function applyParagraphIndent(indent: boolean) {
  if (typeof document === 'undefined') return;
  // Consumed by the editor paragraph rule (tiptap.css / file.css) as a text-indent.
  document.documentElement.style.setProperty('--editor-paragraph-indent', indent ? '2em' : '0');
}

function saveUserPreferencesSnapshot(config: UserPreferencesConfig): void {
  window.orisonDesktop?.saveUserPreferences?.(config).catch(() => {});
}

function buildPrefs(get: () => SettingsSlice, overrides: Partial<UserPreferencesConfig> = {}): UserPreferencesConfig {
  // get() returns the full merged store at runtime; autoSaveEnabled lives in autoSaveSlice.
  const s = get() as SettingsSlice & { autoSaveEnabled: boolean };
  const base: UserPreferencesConfig = {
    theme: s.theme,
    locale: s.locale,
    autoApplyPatches: s.autoApplyPatches,
    autoCheckUpdates: s.autoCheckUpdates,
    readingFontWeight: s.readingFontWeight,
    readingFontScale: s.readingFontScale,
    paragraphIndent: s.paragraphIndent,
    showWordCount: s.showWordCount,
    autoSaveEnabled: s.autoSaveEnabled,
    autoSaveInterval: s.autoSaveInterval,
    spellCheck: s.spellCheck,
    wordCountGoal: s.wordCountGoal,
    editorLineHeight: s.editorLineHeight,
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
      const paragraphIndent = config.paragraphIndent ?? true;
      applyTheme(theme);
      applyReadingFont(readingFontFamily, readingFontWeight, readingFontScale);
      applyEditorLineHeight(editorLineHeight);
      applyParagraphIndent(paragraphIndent);
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
        paragraphIndent: config.paragraphIndent ?? true,
        showWordCount: config.showWordCount ?? true,
        autoSaveEnabled: config.autoSaveEnabled ?? true,
        autoSaveInterval: config.autoSaveInterval ?? DEFAULT_USER_PREFERENCES.autoSaveInterval,
        spellCheck: config.spellCheck ?? false,
        wordCountGoal: config.wordCountGoal ?? 0,
        editorLineHeight,
      } as Partial<SettingsSlice> & { autoSaveEnabled: boolean });
    } catch {
      // Keep defaults when preferences cannot be read.
    }
  },

  persistPreferences() {
    saveUserPreferencesSnapshot(buildPrefs(get));
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
  paragraphIndent: true,
  setParagraphIndent(value) {
    applyParagraphIndent(value);
    set({ paragraphIndent: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { paragraphIndent: value }));
  },
  showWordCount: true,
  setShowWordCount(value) {
    set({ showWordCount: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { showWordCount: value }));
  },
  autoSaveInterval: DEFAULT_USER_PREFERENCES.autoSaveInterval as number,
  setAutoSaveInterval(value) {
    set({ autoSaveInterval: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { autoSaveInterval: value }));
  },
  spellCheck: false,
  setSpellCheck(value) {
    set({ spellCheck: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { spellCheck: value }));
  },
  wordCountGoal: 0,
  setWordCountGoal(value) {
    set({ wordCountGoal: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { wordCountGoal: value }));
  },

  // ── Appearance settings ──
  editorLineHeight: 1.75,
  setEditorLineHeight(value) {
    applyEditorLineHeight(value);
    set({ editorLineHeight: value });
    saveUserPreferencesSnapshot(buildPrefs(get, { editorLineHeight: value }));
  },
});
