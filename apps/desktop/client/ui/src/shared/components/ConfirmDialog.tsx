import { useRef, useEffect } from 'react';
import { useConfirmStore } from '../store/confirmStore';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n/useI18n';

export function ConfirmDialog() {
  const confirmOpen = useConfirmStore((s) => s.confirmOpen);
  const options = useConfirmStore((s) => s.confirmOptions);
  const resolveConfirm = useConfirmStore((s) => s.resolveConfirm);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmOpen) return;
    dialogRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveConfirm(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [confirmOpen, resolveConfirm]);

  if (!confirmOpen || !options) return null;

  const isDanger = options.variant === 'danger';

  return (
    <div
      className="confirm-dialog-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={() => resolveConfirm(false)}
    >
      <div
        className="confirm-dialog"
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="confirm-dialog-title" id="confirm-dialog-title">
          {options.title}
        </h3>
        <p className="confirm-dialog-message">{options.message}</p>
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="confirm-dialog-btn"
            onClick={() => resolveConfirm(false)}
          >
            {options.cancelLabel || t('common.cancel') || '取消'}
          </button>
          <button
            type="button"
            className={`confirm-dialog-btn${isDanger ? ' confirm-dialog-btn--danger' : ' confirm-dialog-btn--primary'}`}
            onClick={() => resolveConfirm(true)}
          >
            {options.confirmLabel || t('common.confirm') || '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}
