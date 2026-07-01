import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n/useI18n';

export function UpdateAvailableDialog() {
  const { open, result, phase, percent, locale, dismiss, download, install } = useAppStore(
    useShallow((s) => ({
      open: s.updateDialogOpen,
      result: s.updateLastResult,
      phase: s.updatePhase,
      percent: s.downloadPercent,
      locale: s.resolvedLocale,
      dismiss: s.dismissUpdateDialog,
      download: s.downloadUpdate,
      install: s.installUpdate,
    })),
  );
  const { t } = useI18n(locale);

  if (!open || !result) return null;

  const openDownload = (url: string) => {
    if (window.orisonDesktop?.openPath) window.orisonDesktop.openPath(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  let body: React.ReactNode;
  let title = t('update.title');

  if (result.status === 'available') {
    title = result.isMajor ? t('update.newMajor') : t('update.available');
    const desc = t('update.availableDesc')
      .replace('{current}', result.currentVersion)
      .replace('{latest}', result.latestVersion);

    let actions: React.ReactNode;
    if (result.manual) {
      // Portable build: no in-app download. Send the user to the releases page.
      const url = result.downloadUrl ?? 'https://github.com/LumenStorm/OrisonSpace/releases/latest';
      actions = (
        <div className="update-actions">
          <button type="button" className="update-btn-secondary" onClick={dismiss}>
            {t('update.later')}
          </button>
          <button
            type="button"
            className="update-btn-primary"
            onClick={() => {
              openDownload(url);
              dismiss();
            }}
          >
            {t('update.download')}
          </button>
        </div>
      );
    } else if (phase === 'downloaded') {
      actions = (
        <div className="update-actions">
          <button type="button" className="update-btn-secondary" onClick={dismiss}>
            {t('update.installLater')}
          </button>
          <button type="button" className="update-btn-primary" onClick={() => void install()}>
            {t('update.restartInstall')}
          </button>
        </div>
      );
    } else if (phase === 'downloading') {
      actions = (
        <div className="update-progress">
          <div className="update-progress-track">
            <div className="update-progress-bar" style={{ width: `${percent}%` }} />
          </div>
          <span className="update-progress-label">
            {t('update.downloadProgress').replace('{percent}', String(percent))}
          </span>
        </div>
      );
    } else {
      actions = (
        <div className="update-actions">
          <button type="button" className="update-btn-secondary" onClick={dismiss}>
            {t('update.later')}
          </button>
          <button type="button" className="update-btn-primary" onClick={() => void download()}>
            {t('update.download')}
          </button>
        </div>
      );
    }

    body = (
      <>
        {result.isMajor && <div className="update-major-banner">{t('update.majorHint')}</div>}
        <p className="about-dialog-desc">{desc}</p>
        {result.releaseNotes && <pre className="update-release-notes">{result.releaseNotes}</pre>}
        {actions}
      </>
    );
  } else if (result.status === 'up-to-date') {
    title = t('update.upToDate');
    body = (
      <>
        <p className="about-dialog-desc">
          {t('update.upToDateDesc').replace('{current}', result.currentVersion)}
        </p>
        <div className="update-actions">
          <button type="button" className="update-btn-primary" onClick={dismiss}>
            {t('update.ok')}
          </button>
        </div>
      </>
    );
  } else if (result.status === 'dev') {
    title = t('update.title');
    body = (
      <>
        <p className="about-dialog-desc">
          {t('update.devDesc').replace('{current}', result.currentVersion)}
        </p>
        <div className="update-actions">
          <button type="button" className="update-btn-primary" onClick={dismiss}>
            {t('update.ok')}
          </button>
        </div>
      </>
    );
  } else if (result.status === 'not-configured') {
    title = t('update.notConfigured');
    body = (
      <>
        <p className="about-dialog-desc">{t('update.notConfiguredDesc')}</p>
        <div className="update-actions">
          <button type="button" className="update-btn-primary" onClick={dismiss}>
            {t('update.ok')}
          </button>
        </div>
      </>
    );
  } else {
    title = t('update.error');
    const fallbackUrl =
      result.status === 'error' ? 'https://github.com/LumenStorm/OrisonSpace/releases/latest' : undefined;
    body = (
      <>
        <p className="about-dialog-desc">{result.message}</p>
        <div className="update-actions">
          <button type="button" className="update-btn-secondary" onClick={dismiss}>
            {t('update.ok')}
          </button>
          {fallbackUrl && (
            <button
              type="button"
              className="update-btn-primary"
              onClick={() => {
                openDownload(fallbackUrl);
                dismiss();
              }}
            >
              {t('update.download')}
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="topbar-new-dialog-overlay" onClick={dismiss}>
      <div className="settings-dialog settings-dialog-sm" onClick={(e) => e.stopPropagation()}>
        <div className="settings-dialog-header">
          <h2 className="settings-dialog-title">{title}</h2>
          <button type="button" className="settings-dialog-close" onClick={dismiss} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="settings-dialog-body about-dialog-body">{body}</div>
      </div>
    </div>
  );
}
