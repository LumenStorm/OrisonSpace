import { create } from 'zustand';

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

type ToastState = {
  toasts: ToastItem[];
  showToast: (message: string, level?: ToastLevel, duration?: number) => void;
  dismissToast: (id: string) => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message, level = 'info', duration?) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ms = duration ?? DEFAULT_DURATIONS[level];
    const item: ToastItem = { id, message, level, duration: ms };
    set((s) => ({ toasts: [...s.toasts.slice(-2), item] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, ms);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
