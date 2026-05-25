import type { StateCreator } from 'zustand';
import type { UpdateCheckResult } from '@orison/shared-contracts';

export type UpdateSlice = {
  updateChecking: boolean;
  updateLastResult: UpdateCheckResult | null;
  updateDialogOpen: boolean;
  checkForUpdate: () => Promise<UpdateCheckResult>;
  dismissUpdateDialog: () => void;
};

export const createUpdateSlice: StateCreator<UpdateSlice, [], [], UpdateSlice> = (set) => ({
  updateChecking: false,
  updateLastResult: null,
  updateDialogOpen: false,

  async checkForUpdate() {
    if (!window.orisonDesktop?.checkForUpdate) {
      const result: UpdateCheckResult = { status: 'not-configured' };
      set({ updateLastResult: result, updateDialogOpen: true });
      return result;
    }
    set({ updateChecking: true });
    try {
      const result = await window.orisonDesktop.checkForUpdate();
      set({ updateLastResult: result, updateChecking: false, updateDialogOpen: true });
      return result;
    } catch (err) {
      const result: UpdateCheckResult = {
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
      set({ updateLastResult: result, updateChecking: false, updateDialogOpen: true });
      return result;
    }
  },

  dismissUpdateDialog() {
    set({ updateDialogOpen: false });
  },
});
