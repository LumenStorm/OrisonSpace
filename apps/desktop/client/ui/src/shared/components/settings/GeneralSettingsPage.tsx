import type { LocaleSetting, ThemeSetting } from '../../store/types';

type Props = {
  t: (key: string) => string;
  theme: ThemeSetting;
  setTheme: (theme: ThemeSetting) => void;
  locale: LocaleSetting;
  setLocale: (locale: LocaleSetting) => void;
  autoCheckUpdates: boolean;
  setAutoCheckUpdates: (value: boolean) => void;
  appVersion: string;
  onCheckForUpdate: () => void;
};

export function GeneralSettingsPage({
  t,
  theme,
  setTheme,
  locale,
  setLocale,
  autoCheckUpdates,
  setAutoCheckUpdates,
  appVersion,
  onCheckForUpdate,
}: Props) {
  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h3 className="settings-page-title">{t('settings.general')}</h3>
      </div>

      <div className="form-field-row">
        <span className="form-field-label">{t('settings.theme')}</span>
        <div className="form-field-options">
          {(['system', 'light', 'dark'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              className={`form-field-option${theme === opt ? ' is-active' : ''}`}
              onClick={() => setTheme(opt)}
            >
              {t(`settings.theme${opt[0].toUpperCase()}${opt.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="form-field-row">
        <span className="form-field-label">{t('settings.language')}</span>
        <div className="form-field-options">
          {(['system', 'en-US', 'zh-CN'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              className={`form-field-option${locale === opt ? ' is-active' : ''}`}
              onClick={() => setLocale(opt)}
            >
              {opt === 'system' ? t('settings.languageSystem') : opt}
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

      <div className="form-field-row">
        <span className="form-field-label">{t('settings.autoCheckUpdates')}</span>
        <div className="form-field-options">
          <button
            type="button"
            className={`form-field-option${autoCheckUpdates ? ' is-active' : ''}`}
            onClick={() => setAutoCheckUpdates(true)}
          >
            {t('settings.on')}
          </button>
          <button
            type="button"
            className={`form-field-option${!autoCheckUpdates ? ' is-active' : ''}`}
            onClick={() => setAutoCheckUpdates(false)}
          >
            {t('settings.off')}
          </button>
        </div>
      </div>

      <div className="form-field-row">
        <span className="form-field-label">
          {t('settings.currentVersion')}
          {appVersion && <span className="form-field-version"> v{appVersion}</span>}
        </span>
        <div className="form-field-options">
          <button type="button" className="form-field-option" onClick={onCheckForUpdate}>
            {t('topbar.checkForUpdate')}
          </button>
        </div>
      </div>
    </div>
  );
}
