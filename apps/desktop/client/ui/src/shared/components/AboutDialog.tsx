import { useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n/useI18n';
import { useDialogA11y } from '../hooks/useDialogA11y';

type Props = { onClose: () => void };

export function AboutDialog({ onClose }: Props) {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const appVersion = useAppStore((s) => s.appVersion);
  const { t } = useI18n(resolvedLocale);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onClose);

  return (
    <div className="topbar-new-dialog-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="settings-dialog settings-dialog-sm" ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="settings-dialog-header">
          <h2 className="settings-dialog-title">{t('topbar.about')}</h2>
          <button type="button" className="settings-dialog-close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="settings-dialog-body about-dialog-body">
          <div className="about-dialog-brand">{t('welcome.brand')}</div>
          <div className="about-dialog-version">v{appVersion || '—'}</div>
          <p className="about-dialog-desc">{t('welcome.tagline')}</p>
        </div>
      </div>
    </div>
  );
}
