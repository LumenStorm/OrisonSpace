import { useToastStore } from '../store/toastStore';

export function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.level}`}
          onClick={() => dismissToast(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
