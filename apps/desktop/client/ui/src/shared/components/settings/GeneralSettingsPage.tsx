import { useEffect, useMemo, useState } from 'react';
import type { ImportedFont } from '@orison/shared-contracts';
import type { LocaleSetting, ThemeSetting } from '../../store/types';
import { FontPicker, type FontOption } from './FontPicker';
import { CHINESE_FONT_PRESETS, injectImportedFonts, isFontInstalled } from './fonts';

type Props = {
  t: (key: string) => string;
  theme: ThemeSetting;
  setTheme: (theme: ThemeSetting) => void;
  locale: LocaleSetting;
  setLocale: (locale: LocaleSetting) => void;
  readingFontFamily: string;
  setReadingFontFamily: (value: string) => void;
  readingFontWeight: number;
  setReadingFontWeight: (value: number) => void;
  readingFontScale: number;
  setReadingFontScale: (value: number) => void;
  autoCheckUpdates: boolean;
  setAutoCheckUpdates: (value: boolean) => void;
  appVersion: string;
  onCheckForUpdate: () => void;
};

const WEIGHT_OPTIONS: { value: number; key: string }[] = [
  { value: 400, key: 'settings.fontWeightNormal' },
  { value: 500, key: 'settings.fontWeightMedium' },
  { value: 600, key: 'settings.fontWeightSemibold' },
  { value: 700, key: 'settings.fontWeightBold' },
];

const SCALE_OPTIONS: { value: number; key: string }[] = [
  { value: 0.9, key: 'settings.fontSizeSmall' },
  { value: 1, key: 'settings.fontSizeDefault' },
  { value: 1.15, key: 'settings.fontSizeLarge' },
  { value: 1.3, key: 'settings.fontSizeXLarge' },
];

export function GeneralSettingsPage({
  t,
  theme,
  setTheme,
  locale,
  setLocale,
  readingFontFamily,
  setReadingFontFamily,
  readingFontWeight,
  setReadingFontWeight,
  readingFontScale,
  setReadingFontScale,
  autoCheckUpdates,
  setAutoCheckUpdates,
  appVersion,
  onCheckForUpdate,
}: Props) {
  const [importedFonts, setImportedFonts] = useState<ImportedFont[]>([]);

  useEffect(() => {
    let alive = true;
    window.orisonDesktop
      ?.listImportedFonts?.()
      .then((fonts) => {
        if (!alive) return;
        injectImportedFonts(fonts);
        setImportedFonts(fonts);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const handleImport = async () => {
    const fonts = await window.orisonDesktop?.importFonts?.();
    if (!fonts) return;
    injectImportedFonts(fonts);
    setImportedFonts(fonts);
  };

  const fontOptions = useMemo<FontOption[]>(() => {
    const presets = CHINESE_FONT_PRESETS.filter((p) => isFontInstalled(p.family)).map((p) => ({
      value: p.value,
      label: p.label,
    }));
    const imported = importedFonts.map((f) => ({ value: f.family, label: f.family }));
    return [...presets, ...imported];
  }, [importedFonts]);

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h3 className="settings-page-title">{t('settings.general')}</h3>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.theme')}</span>
        <div className="sidebar-settings-options">
          {(['system', 'light', 'dark'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              className={`sidebar-settings-option${theme === opt ? ' is-active' : ''}`}
              onClick={() => setTheme(opt)}
            >
              {t(`settings.theme${opt[0].toUpperCase()}${opt.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.language')}</span>
        <div className="sidebar-settings-options">
          {(['system', 'en-US', 'zh-CN'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              className={`sidebar-settings-option${locale === opt ? ' is-active' : ''}`}
              onClick={() => setLocale(opt)}
            >
              {opt === 'system' ? t('settings.languageSystem') : opt}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-page-header">
        <div>
          <h3 className="settings-page-title">{t('settings.readingFont')}</h3>
          <p className="settings-page-subtitle">{t('settings.readingFontDesc')}</p>
        </div>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.fontFamily')}</span>
        <FontPicker
          value={readingFontFamily}
          onChange={setReadingFontFamily}
          options={fontOptions}
          defaultLabel={t('settings.fontFamilyDefault')}
          sampleText={t('settings.fontSample')}
          importLabel={t('settings.fontImport')}
          onImport={handleImport}
        />
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.fontWeight')}</span>
        <div className="sidebar-settings-options">
          {WEIGHT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`sidebar-settings-option${readingFontWeight === opt.value ? ' is-active' : ''}`}
              style={{ fontWeight: opt.value }}
              onClick={() => setReadingFontWeight(opt.value)}
            >
              {t(opt.key)}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.fontSize')}</span>
        <div className="sidebar-settings-options">
          {SCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`sidebar-settings-option${readingFontScale === opt.value ? ' is-active' : ''}`}
              onClick={() => setReadingFontScale(opt.value)}
            >
              {t(opt.key)}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-page-header">
        <div>
          <h3 className="settings-page-title">{t('settings.updates')}</h3>
          <p className="settings-page-subtitle">{t('settings.updatesDesc')}</p>
        </div>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.autoCheckUpdates')}</span>
        <div className="sidebar-settings-options">
          <button
            type="button"
            className={`sidebar-settings-option${autoCheckUpdates ? ' is-active' : ''}`}
            onClick={() => setAutoCheckUpdates(true)}
          >
            {t('settings.on')}
          </button>
          <button
            type="button"
            className={`sidebar-settings-option${!autoCheckUpdates ? ' is-active' : ''}`}
            onClick={() => setAutoCheckUpdates(false)}
          >
            {t('settings.off')}
          </button>
        </div>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">
          {t('settings.currentVersion')}
          {appVersion && <span className="sidebar-settings-version"> v{appVersion}</span>}
        </span>
        <div className="sidebar-settings-options">
          <button type="button" className="sidebar-settings-option" onClick={onCheckForUpdate}>
            {t('topbar.checkForUpdate')}
          </button>
        </div>
      </div>
    </div>
  );
}
