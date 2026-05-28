import type { StateCreator } from 'zustand';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
};

export type ConfirmSlice = {
  confirmOpen: boolean;
  confirmOptions: ConfirmOptions | null;
  confirmResolve: ((value: boolean) => void) | null;
  requestConfirm: (options: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (value: boolean) => void;
};

export const createConfirmSlice: StateCreator<ConfirmSlice, [], [], ConfirmSlice> = (set, get) => ({
  confirmOpen: false,
  confirmOptions: null,
  confirmResolve: null,
  requestConfirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({ confirmOpen: true, confirmOptions: options, confirmResolve: resolve });
    });
  },
  resolveConfirm: (value) => {
    const { confirmResolve } = get();
    if (confirmResolve) confirmResolve(value);
    set({ confirmOpen: false, confirmOptions: null, confirmResolve: null });
  },
});
