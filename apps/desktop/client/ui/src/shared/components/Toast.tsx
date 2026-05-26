import { useAppStore } from '../store/appStore';

export function Toast() {
  const message = useAppStore((s) => s.toastMessage);
  if (!message) return null;

  return (
    <div className="toast-container">
      <div className="toast">{message}</div>
    </div>
  );
}
