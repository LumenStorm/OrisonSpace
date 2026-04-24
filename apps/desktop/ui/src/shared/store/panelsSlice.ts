import type { StateCreator } from 'zustand';
import {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  INSPECTOR_WIDTH_DEFAULT,
  INSPECTOR_WIDTH_MIN,
  INSPECTOR_WIDTH_MAX,
} from '../constants';

export type PanelsSlice = {
  inspectorOpen: boolean;
  toggleInspector: () => void;
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  inspectorWidth: number;
  setInspectorWidth: (w: number) => void;
};

export const createPanelsSlice: StateCreator<PanelsSlice, [], [], PanelsSlice> = (set) => ({
  inspectorOpen: true,
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  sidebarWidth: SIDEBAR_WIDTH_DEFAULT,
  setSidebarWidth: (w) => set({ sidebarWidth: Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, w)) }),
  inspectorWidth: INSPECTOR_WIDTH_DEFAULT,
  setInspectorWidth: (w) => set({ inspectorWidth: Math.max(INSPECTOR_WIDTH_MIN, Math.min(INSPECTOR_WIDTH_MAX, w)) }),
});
