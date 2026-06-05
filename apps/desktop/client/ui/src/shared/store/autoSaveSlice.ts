import type { StateCreator } from 'zustand';

/** Lifecycle of an autosave pass, surfaced in the status bar. */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type AutoSaveSlice = {
  /** When false, the autosave hook stays dormant (manual Ctrl+S still works). */
  autoSaveEnabled: boolean;
  saveStatus: SaveStatus;
  /** Epoch ms of the last successful autosave, or null if none yet. */
  lastSavedAt: number | null;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setLastSavedAt: (timestamp: number | null) => void;
};

export const createAutoSaveSlice: StateCreator<AutoSaveSlice, [], [], AutoSaveSlice> = (set) => ({
  autoSaveEnabled: true,
  saveStatus: 'idle',
  lastSavedAt: null,
  setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setLastSavedAt: (timestamp) => set({ lastSavedAt: timestamp }),
});
