import type { StateCreator } from 'zustand';
import type { UpdateCheckResult, UpdateEvent } from '@orison/shared-contracts';

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export type UpdateSlice = {
  updateChecking: boolean;
  updateLastResult: UpdateCheckResult | null;
  updateDialogOpen: boolean;
  updatePhase: UpdatePhase;
  downloadPercent: number;
  /** True once the renderer has subscribed to main's update:event stream. */
  updateSubscribed: boolean;
  checkForUpdate: () => Promise<UpdateCheckResult>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  dismissUpdateDialog: () => void;
  /** Subscribe to main-process update events. Call once at bootstrap. */
  subscribeUpdateEvents: () => void;
};

export const createUpdateSlice: StateCreator<UpdateSlice, [], [], UpdateSlice> = (set, get) => ({
  updateChecking: false,
  updateLastResult: null,
  updateDialogOpen: false,
  updatePhase: 'idle',
  downloadPercent: 0,
  updateSubscribed: false,

  async checkForUpdate() {
    if (!window.orisonDesktop?.checkForUpdate) {
      const result: UpdateCheckResult = { status: 'not-configured' };
      set({ updateLastResult: result, updateDialogOpen: true });
      return result;
    }
    set({ updateChecking: true, updatePhase: 'checking' });
    try {
      const result = await window.orisonDesktop.checkForUpdate();
      set({
        updateLastResult: result,
        updateChecking: false,
        updateDialogOpen: true,
        updatePhase: result.status === 'available' ? 'available' : 'idle',
      });
      return result;
    } catch (err) {
      const result: UpdateCheckResult = {
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
      set({ updateLastResult: result, updateChecking: false, updateDialogOpen: true, updatePhase: 'error' });
      return result;
    }
  },

  async downloadUpdate() {
    if (!window.orisonDesktop?.downloadUpdate) return;
    set({ updatePhase: 'downloading', downloadPercent: 0 });
    try {
      await window.orisonDesktop.downloadUpdate();
    } catch (err) {
      set({
        updatePhase: 'error',
        updateLastResult: {
          status: 'error',
          message: err instanceof Error ? err.message : 'Download failed',
        },
      });
    }
  },

  async installUpdate() {
    await window.orisonDesktop?.installUpdate?.();
  },

  dismissUpdateDialog() {
    set({ updateDialogOpen: false });
  },

  subscribeUpdateEvents() {
    if (get().updateSubscribed || !window.orisonDesktop?.onUpdateEvent) return;
    set({ updateSubscribed: true });
    window.orisonDesktop.onUpdateEvent((event: UpdateEvent) => {
      switch (event.type) {
        case 'checking':
          set({ updatePhase: 'checking' });
          break;
        case 'available':
          set({
            updatePhase: 'available',
            updateDialogOpen: true,
            updateLastResult: {
              status: 'available',
              currentVersion: event.currentVersion,
              latestVersion: event.latestVersion,
              isMajor: event.isMajor,
              releaseNotes: event.releaseNotes,
              manual: event.manual,
              downloadUrl: event.downloadUrl,
            },
          });
          break;
        case 'not-available':
          set({ updatePhase: 'idle' });
          break;
        case 'download-progress':
          set({ updatePhase: 'downloading', downloadPercent: event.percent });
          break;
        case 'downloaded':
          set({ updatePhase: 'downloaded', downloadPercent: 100, updateDialogOpen: true });
          break;
        case 'error':
          set({
            updatePhase: 'error',
            updateLastResult: { status: 'error', message: event.message },
          });
          break;
      }
    });
  },
});
