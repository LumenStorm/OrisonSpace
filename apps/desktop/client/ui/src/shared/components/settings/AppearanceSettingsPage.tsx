import { useEffect, useMemo, useState } from 'react';
import type { ImportedFont } from '@orison/shared-contracts';
import { FontPicker, type FontOption } from './FontPicker';
import { CHINESE_FONT_PRESETS, injectImportedFonts, isFontInstalled } from './fonts';

type Props = {
  t: (key: string) => string;
  editorLineHeight: number;
  setEditorLineHeight: (value: number) => void;
  readingFontFamily: string;
  setReadingFontFamily: (value: string) => void;
  readingFontWeight: number;
  setReadingFontWeight: (value: number) => void;
  readingFontScale: number;
  setReadingFontScale: (value: number) => void;
};

const LINE_HEIGHT_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1.5, label: '1.5' },
  { value: 1.75, label: '1.75' },
  { value: 2.0, label: '2.0' },
];

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

export function AppearanceSettingsPage({
  t,
  editorLineHeight,
  setEditorLineHeight,
  readingFontFamily,
  setReadingFontFamily,
  readingFontWeight,
  setReadingFontWeight,
  readingFontScale,
  setReadingFontScale,
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
        <h3 className="settings-page-title">{t('settings.appearance')}</h3>
      </div>

      <div className="form-field-row">
        <span className="form-field-label">{t('settings.editorLineHeight')}</span>
        <div className="form-field-options">
          {LINE_HEIGHT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`form-field-option${editorLineHeight === opt.value ? ' is-active' : ''}`}
              onClick={() => setEditorLineHeight(opt.value)}
            >
              {opt.label}
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

      <div className="form-field-row">
        <span className="form-field-label">{t('settings.fontFamily')}</span>
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

      <div className="form-field-row">
        <span className="form-field-label">{t('settings.fontWeight')}</span>
        <div className="form-field-options">
          {WEIGHT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`form-field-option${readingFontWeight === opt.value ? ' is-active' : ''}`}
              style={{ fontWeight: opt.value }}
              onClick={() => setReadingFontWeight(opt.value)}
            >
              {t(opt.key)}
            </button>
          ))}
        </div>
      </div>

      <div className="form-field-row">
        <span className="form-field-label">{t('settings.fontSize')}</span>
        <div className="form-field-options">
          {SCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`form-field-option${readingFontScale === opt.value ? ' is-active' : ''}`}
              onClick={() => setReadingFontScale(opt.value)}
            >
              {t(opt.key)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
