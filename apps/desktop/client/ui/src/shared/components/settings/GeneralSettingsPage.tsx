import type { LocaleSetting, ThemeSetting } from '../../store/types';

type Props = {
  t: (key: string) => string;
  theme: ThemeSetting;
  setTheme: (theme: ThemeSetting) => void;
  locale: LocaleSetting;
  setLocale: (locale: LocaleSetting) => void;
  autoApplyPatches: boolean;
  setAutoApplyPatches: (value: boolean) => void;
  updateManifestUrl: string;
  setUpdateManifestUrl: (url: string) => void;
};

export function GeneralSettingsPage({
  t,
  theme,
  setTheme,
  locale,
  setLocale,
  autoApplyPatches,
  setAutoApplyPatches,
  updateManifestUrl,
  setUpdateManifestUrl,
}: Props) {
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

      <div className="sidebar-settings-divider" />

      <div className="sidebar-settings-row">
        <label className="sidebar-settings-toggle-row">
          <input
            type="checkbox"
            className="sidebar-settings-checkbox"
            checked={autoApplyPatches}
            onChange={(e) => setAutoApplyPatches(e.target.checked)}
          />
          <span className="sidebar-settings-label">{t('settings.autoApply')}</span>
        </label>
        <span className="sidebar-settings-hint">{t('settings.autoApplyDesc')}</span>
      </div>

      <div className="sidebar-settings-divider" />

      <label className="sidebar-settings-input-row">
        <span className="sidebar-settings-input-label">{t('settings.updateManifestUrl')}</span>
        <input
          type="url"
          className="sidebar-settings-input"
          placeholder="https://example.com/orison/latest.json"
          value={updateManifestUrl}
          onChange={(e) => setUpdateManifestUrl(e.target.value)}
          spellCheck={false}
        />
      </label>
      <span className="sidebar-settings-hint">{t('settings.updateManifestHint')}</span>
    </div>
  );
}
