import { useCallback, useEffect, useRef, useState } from 'react';
import { useDialogA11y } from '../../shared/hooks/useDialogA11y';

type ProjectNameDialogProps = {
  title: string;
  label: string;
  initialName: string;
  confirmLabel: string;
  busyLabel: string;
  cancelLabel: string;
  onSubmit: (name: string) => Promise<string | null>;
  onClose: () => void;
};

export function ProjectNameDialog({
  title,
  label,
  initialName,
  confirmLabel,
  busyLabel,
  cancelLabel,
  onSubmit,
  onClose,
}: ProjectNameDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    if (!submitting) onClose();
  }, [onClose, submitting]);
  useDialogA11y(dialogRef, handleClose);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setError(null);
    setSubmitting(true);
    const nextError = await onSubmit(trimmed);
    if (nextError) {
      setError(nextError);
      setSubmitting(false);
      inputRef.current?.focus();
      return;
    }
    onClose();
  };

  return (
    <div className="topbar-new-dialog-overlay" role="presentation" onClick={handleClose}>
      <div
        className="settings-dialog settings-dialog-sm project-name-dialog"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-name-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-dialog-header">
          <h2 className="settings-dialog-title" id="project-name-dialog-title">{title}</h2>
          <button type="button" className="settings-dialog-close" onClick={handleClose} aria-label={cancelLabel} disabled={submitting}>
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
        <div className="settings-dialog-body">
          <label className="form-field-row" htmlFor="project-name-input">
            <span className="form-field-label">{label}</span>
            <input
              ref={inputRef}
              id="project-name-input"
              className="auth-input"
              type="text"
              value={name}
              maxLength={120}
              disabled={submitting}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'project-name-dialog-error' : undefined}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
            />
          </label>
          {error && <p className="project-name-dialog-error" id="project-name-dialog-error" role="alert">{error}</p>}
          <div className="topbar-new-dialog-actions">
            <button type="button" className="auth-submit" disabled={!name.trim() || submitting} onClick={() => void handleSubmit()}>
              {submitting ? busyLabel : confirmLabel}
            </button>
            <button type="button" className="projects-cancel" disabled={submitting} onClick={handleClose}>
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
