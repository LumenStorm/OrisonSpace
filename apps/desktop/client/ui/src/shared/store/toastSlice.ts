import type { StateCreator } from 'zustand';

export type ToastSlice = {
  toastMessage: string | null;
  showToast: (message: string) => void;
  clearToast: () => void;
};

export const createToastSlice: StateCreator<ToastSlice, [], [], ToastSlice> = (set) => ({
  toastMessage: null,
  showToast: (message) => {
    set({ toastMessage: message });
    setTimeout(() => set({ toastMessage: null }), 2000);
  },
  clearToast: () => set({ toastMessage: null }),
});
