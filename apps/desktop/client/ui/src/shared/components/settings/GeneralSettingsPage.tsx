import type { LocaleSetting, ThemeSetting } from '../../store/types';

type Props = {
  t: (key: string) => string;
  theme: ThemeSetting;
  setTheme: (theme: ThemeSetting) => void;
  locale: LocaleSetting;
  setLocale: (locale: LocaleSetting) => void;
};

export function GeneralSettingsPage({
  t,
  theme,
  setTheme,
  locale,
  setLocale,
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

    </div>
  );
}
