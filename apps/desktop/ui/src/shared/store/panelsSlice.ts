import type { StateCreator } from 'zustand';
import type { BottomPanelTab, SidebarPanel } from './types';
import {
  PROJECT_TREE_WIDTH_DEFAULT,
  PROJECT_TREE_WIDTH_MIN,
  PROJECT_TREE_WIDTH_MAX,
  BOTTOM_PANEL_HEIGHT_DEFAULT,
  BOTTOM_PANEL_HEIGHT_MIN,
  BOTTOM_PANEL_HEIGHT_MAX,
  AGENT_PANEL_WIDTH_DEFAULT,
  AGENT_PANEL_WIDTH_MIN,
  AGENT_PANEL_WIDTH_MAX,
} from '../constants';

export type PanelsSlice = {
  projectTreeOpen: boolean;
  toggleProjectTree: () => void;
  projectTreeWidth: number;
  setProjectTreeWidth: (w: number) => void;
  activeSidebarPanel: SidebarPanel;
  setActiveSidebarPanel: (panel: SidebarPanel) => void;
  bottomPanelOpen: boolean;
  toggleBottomPanel: () => void;
  bottomPanelHeight: number;
  setBottomPanelHeight: (h: number) => void;
  activeBottomTab: BottomPanelTab;
  setActiveBottomTab: (tab: BottomPanelTab) => void;
  agentPanelOpen: boolean;
  toggleAgentPanel: () => void;
  agentPanelWidth: number;
  setAgentPanelWidth: (w: number) => void;
};

export const createPanelsSlice: StateCreator<PanelsSlice, [], [], PanelsSlice> = (set) => ({
  projectTreeOpen: true,
  toggleProjectTree: () => set((s) => ({ projectTreeOpen: !s.projectTreeOpen })),
  projectTreeWidth: PROJECT_TREE_WIDTH_DEFAULT,
  setProjectTreeWidth: (w) => set({ projectTreeWidth: Math.max(PROJECT_TREE_WIDTH_MIN, Math.min(PROJECT_TREE_WIDTH_MAX, w)) }),
  activeSidebarPanel: 'explorer',
  setActiveSidebarPanel: (panel) => set({ activeSidebarPanel: panel, projectTreeOpen: true }),
  bottomPanelOpen: true,
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
  bottomPanelHeight: BOTTOM_PANEL_HEIGHT_DEFAULT,
  setBottomPanelHeight: (h) => set({ bottomPanelHeight: Math.max(BOTTOM_PANEL_HEIGHT_MIN, Math.min(BOTTOM_PANEL_HEIGHT_MAX, h)) }),
  activeBottomTab: 'properties',
  setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),
  agentPanelOpen: false,
  toggleAgentPanel: () => set((s) => ({ agentPanelOpen: !s.agentPanelOpen })),
  agentPanelWidth: AGENT_PANEL_WIDTH_DEFAULT,
  setAgentPanelWidth: (w) => set({ agentPanelWidth: Math.max(AGENT_PANEL_WIDTH_MIN, Math.min(AGENT_PANEL_WIDTH_MAX, w)) }),
});
