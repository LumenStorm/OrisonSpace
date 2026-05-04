type Props = {
  variant: 'error' | 'notice';
  message: string;
  onDismiss?: () => void;
};

export function EditorBanner({ variant, message, onDismiss }: Props) {
  const role = variant === 'error' ? 'alert' : 'status';
  const icon = variant === 'error' ? 'error' : 'info';

  return (
    <div className={`model-editor-banner is-${variant}`} role={role}>
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
      <span>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          className="model-editor-banner-close"
          onClick={onDismiss}
          aria-label="Close"
        >
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      ) : null}
    </div>
  );
}
