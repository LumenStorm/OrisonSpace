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
    <div className="settings-page about-page">
      <header className="about-hero">
        <div className="about-logo" aria-hidden="true">
          <span className="material-symbols-outlined">ink_pen</span>
        </div>
        <div className="about-brand">
          <span className="about-name">Orison Space</span>
          {appVersion && <span className="about-version">v{appVersion}</span>}
        </div>
        <p className="about-tagline">{t('settings.aboutTagline')}</p>
      </header>

      <div className="about-links">
        <button type="button" className="about-link-card" onClick={() => openExternal(HOMEPAGE_URL)}>
          <span className="about-link-icon material-symbols-outlined" aria-hidden="true">home</span>
          <span className="about-link-text">
            <span className="about-link-label">{t('settings.aboutHomepage')}</span>
            <span className="about-link-value">github.com/LumenStorm/OrisonSpace</span>
          </span>
          <span className="about-link-action material-symbols-outlined" aria-hidden="true">open_in_new</span>
        </button>

        <button type="button" className="about-link-card" onClick={() => openExternal(DEVELOPER_URL)}>
          <span className="about-link-icon material-symbols-outlined" aria-hidden="true">code</span>
          <span className="about-link-text">
            <span className="about-link-label">{t('settings.aboutDeveloper')}</span>
            <span className="about-link-value">LightYuki</span>
          </span>
          <span className="about-link-action material-symbols-outlined" aria-hidden="true">open_in_new</span>
        </button>

        <button type="button" className="about-link-card" onClick={() => openExternal(FEEDBACK_URL)}>
          <span className="about-link-icon material-symbols-outlined" aria-hidden="true">forum</span>
          <span className="about-link-text">
            <span className="about-link-label">{t('settings.aboutFeedback')}</span>
            <span className="about-link-value">{t('settings.aboutFeedbackValue')}</span>
          </span>
          <span className="about-link-action material-symbols-outlined" aria-hidden="true">open_in_new</span>
        </button>

        <button type="button" className="about-link-card" onClick={copyQQ} title={t('settings.aboutCopied')}>
          <span className="about-link-icon material-symbols-outlined" aria-hidden="true">groups</span>
          <span className="about-link-text">
            <span className="about-link-label">{t('settings.aboutQQGroup')}</span>
            <span className="about-link-value">{QQ_GROUP}</span>
          </span>
          <span className="about-link-action material-symbols-outlined" aria-hidden="true">content_copy</span>
        </button>
      </div>

      <p className="about-license">{t('settings.aboutLicenseNotice')}</p>
    </div>
  );
}
