import type { StateCreator } from 'zustand';
import type { BottomPanelTab } from './types';
import {
  PROJECT_TREE_WIDTH_DEFAULT,
  PROJECT_TREE_WIDTH_MIN,
  PROJECT_TREE_WIDTH_MAX,
  BOTTOM_PANEL_HEIGHT_DEFAULT,
  BOTTOM_PANEL_HEIGHT_MIN,
  BOTTOM_PANEL_HEIGHT_MAX,
} from '../constants';

export type PanelsSlice = {
  projectTreeOpen: boolean;
  toggleProjectTree: () => void;
  projectTreeWidth: number;
  setProjectTreeWidth: (w: number) => void;
  bottomPanelOpen: boolean;
  toggleBottomPanel: () => void;
  bottomPanelHeight: number;
  setBottomPanelHeight: (h: number) => void;
  activeBottomTab: BottomPanelTab;
  setActiveBottomTab: (tab: BottomPanelTab) => void;
};

export const createPanelsSlice: StateCreator<PanelsSlice, [], [], PanelsSlice> = (set) => ({
  projectTreeOpen: true,
  toggleProjectTree: () => set((s) => ({ projectTreeOpen: !s.projectTreeOpen })),
  projectTreeWidth: PROJECT_TREE_WIDTH_DEFAULT,
  setProjectTreeWidth: (w) => set({ projectTreeWidth: Math.max(PROJECT_TREE_WIDTH_MIN, Math.min(PROJECT_TREE_WIDTH_MAX, w)) }),
  bottomPanelOpen: true,
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
  bottomPanelHeight: BOTTOM_PANEL_HEIGHT_DEFAULT,
  setBottomPanelHeight: (h) => set({ bottomPanelHeight: Math.max(BOTTOM_PANEL_HEIGHT_MIN, Math.min(BOTTOM_PANEL_HEIGHT_MAX, h)) }),
  activeBottomTab: 'properties',
  setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),
});
