import type { StateCreator } from 'zustand';
import {
  PROJECT_TREE_WIDTH_DEFAULT,
  PROJECT_TREE_WIDTH_MIN,
  PROJECT_TREE_WIDTH_MAX,
  INSPECTOR_WIDTH_DEFAULT,
  INSPECTOR_WIDTH_MIN,
  INSPECTOR_WIDTH_MAX,
} from '../constants';

export type PanelsSlice = {
  inspectorOpen: boolean;
  toggleInspector: () => void;
  projectTreeOpen: boolean;
  toggleProjectTree: () => void;
  projectTreeWidth: number;
  setProjectTreeWidth: (w: number) => void;
  inspectorWidth: number;
  setInspectorWidth: (w: number) => void;
};

export const createPanelsSlice: StateCreator<PanelsSlice, [], [], PanelsSlice> = (set) => ({
  inspectorOpen: true,
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  projectTreeOpen: true,
  toggleProjectTree: () => set((s) => ({ projectTreeOpen: !s.projectTreeOpen })),
  projectTreeWidth: PROJECT_TREE_WIDTH_DEFAULT,
  setProjectTreeWidth: (w) => set({ projectTreeWidth: Math.max(PROJECT_TREE_WIDTH_MIN, Math.min(PROJECT_TREE_WIDTH_MAX, w)) }),
  inspectorWidth: INSPECTOR_WIDTH_DEFAULT,
  setInspectorWidth: (w) => set({ inspectorWidth: Math.max(INSPECTOR_WIDTH_MIN, Math.min(INSPECTOR_WIDTH_MAX, w)) }),
});
