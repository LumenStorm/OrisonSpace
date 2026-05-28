import type { StateCreator } from 'zustand';

export type ToastLevel = 'info' | 'success' | 'warning' | 'error';

export type ToastItem = {
  id: string;
  message: string;
  level: ToastLevel;
  duration: number;
};

const DEFAULT_DURATIONS: Record<ToastLevel, number> = {
  success: 2000,
  info: 3000,
  warning: 4000,
  error: 5000,
};

export type ToastSlice = {
  toasts: ToastItem[];
  showToast: (message: string, level?: ToastLevel, duration?: number) => void;
  dismissToast: (id: string) => void;
  clearToast: () => void;
  /** @deprecated use showToast instead */
  toastMessage: string | null;
};

export const createToastSlice: StateCreator<ToastSlice, [], [], ToastSlice> = (set, get) => ({
  toasts: [],
  toastMessage: null,
  showToast: (message, level = 'info', duration?) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ms = duration ?? DEFAULT_DURATIONS[level];
    const item: ToastItem = { id, message, level, duration: ms };
    set((s) => ({ toasts: [...s.toasts.slice(-2), item], toastMessage: message }));
    setTimeout(() => {
      set((s) => ({
        toasts: s.toasts.filter((t) => t.id !== id),
        toastMessage: s.toasts.length <= 1 ? null : s.toastMessage,
      }));
    }, ms);
  },
  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  clearToast: () => set({ toasts: [], toastMessage: null }),
});
