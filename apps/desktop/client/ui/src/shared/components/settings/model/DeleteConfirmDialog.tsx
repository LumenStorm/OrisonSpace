import { useEffect, useRef } from 'react';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      // Defer focus so the dialog is fully mounted.
      requestAnimationFrame(() => confirmRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="topbar-new-dialog-overlay" onClick={onCancel} role="presentation">
      <div
        className="settings-dialog settings-dialog-sm delete-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-dialog-header">
          <h2 className="settings-dialog-title" id="delete-confirm-title">{title}</h2>
        </div>
        <div className="settings-dialog-body">
          <p id="delete-confirm-desc" className="delete-confirm-desc">{description}</p>
          <div className="delete-confirm-actions">
            <button type="button" className="settings-refresh-button delete-confirm-cancel" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              className="delete-confirm-action"
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
