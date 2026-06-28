const HOMEPAGE_URL = 'https://github.com/LumenStorm/OrisonSpace';
const DEVELOPER_URL = 'https://github.com/LightYuki';
const FEEDBACK_URL = 'https://github.com/LumenStorm/OrisonSpace/issues';
const QQ_GROUP = '582838912';

type Props = {
  t: (key: string) => string;
  appVersion: string;
  onCopied: () => void;
};

function openExternal(url: string): void {
  window.orisonDesktop?.openExternal?.(url);
}

export function AboutSettingsPage({ t, appVersion, onCopied }: Props) {
  const copyQQ = async () => {
    try {
      await navigator.clipboard.writeText(QQ_GROUP);
      onCopied();
    } catch {
      /* clipboard blocked — the number is shown inline, user can copy manually */
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <h3 className="settings-page-title">
            Orison Space
            {appVersion && <span className="sidebar-settings-version"> v{appVersion}</span>}
          </h3>
          <p className="settings-page-subtitle">{t('settings.aboutTagline')}</p>
        </div>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.aboutHomepage')}</span>
        <div className="sidebar-settings-options">
          <button type="button" className="sidebar-settings-option" onClick={() => openExternal(HOMEPAGE_URL)}>
            github.com/LumenStorm/OrisonSpace
            <span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>
          </button>
        </div>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.aboutDeveloper')}</span>
        <div className="sidebar-settings-options">
          <button type="button" className="sidebar-settings-option" onClick={() => openExternal(DEVELOPER_URL)}>
            LightYuki
            <span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>
          </button>
        </div>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.aboutFeedback')}</span>
        <div className="sidebar-settings-options">
          <button type="button" className="sidebar-settings-option" onClick={() => openExternal(FEEDBACK_URL)}>
            {t('settings.aboutFeedbackValue')}
            <span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>
          </button>
        </div>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.aboutQQGroup')}</span>
        <div className="sidebar-settings-options">
          <button type="button" className="sidebar-settings-option" onClick={copyQQ} title={t('settings.aboutCopied')}>
            {QQ_GROUP}
            <span className="material-symbols-outlined" aria-hidden="true">content_copy</span>
          </button>
        </div>
      </div>

      <p className="settings-page-subtitle about-license-notice">{t('settings.aboutLicenseNotice')}</p>
    </div>
  );
}
