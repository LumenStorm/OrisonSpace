import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n/useI18n';

export function UpdateAvailableDialog() {
  const { open, result, locale, dismiss } = useAppStore(
    useShallow((s) => ({
      open: s.updateDialogOpen,
      result: s.updateLastResult,
      locale: s.resolvedLocale,
      dismiss: s.dismissUpdateDialog,
    })),
  );
  const { t } = useI18n(locale);

  if (!open || !result) return null;

  const openDownload = (url: string) => {
    window.orisonDesktop?.openPath?.(url) ?? window.open(url, '_blank', 'noopener,noreferrer');
  };

  let body: React.ReactNode;
  let title = t('update.title');

  if (result.status === 'available') {
    title = t('update.available');
    body = (
      <>
        <p className="about-dialog-desc">
          {t('update.availableDesc')
            .replace('{current}', result.currentVersion)
            .replace('{latest}', result.latestVersion)}
        </p>
        {result.releaseNotes && (
          <pre className="update-release-notes">{result.releaseNotes}</pre>
        )}
        <div className="update-actions">
          <button type="button" className="update-btn-secondary" onClick={dismiss}>
            {t('update.later')}
          </button>
          <button
            type="button"
            className="update-btn-primary"
            onClick={() => {
              openDownload(result.downloadUrl);
              dismiss();
            }}
          >
            {t('update.download')}
          </button>
        </div>
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
    body = (
      <>
        <p className="about-dialog-desc">{result.message}</p>
        <div className="update-actions">
          <button type="button" className="update-btn-primary" onClick={dismiss}>
            {t('update.ok')}
          </button>
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
