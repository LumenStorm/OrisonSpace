import type { StateCreator } from 'zustand';
import type { ActivePage, BottomPanelTab, SidebarPanel } from './types';
import { storage } from './storage';
import { registerProjectReset } from './resetRegistry';
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

export type SplitDirection = 'none' | 'horizontal' | 'vertical' | 'outline';

export type MainView = 'page' | 'files';

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
  setAgentPanelOpen: (open: boolean) => void;
  agentPanelWidth: number;
  setAgentPanelWidth: (w: number) => void;
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;
  mainView: MainView;
  setMainView: (view: MainView) => void;
  splitDirection: SplitDirection;
  splitFilePath: string | null;
  setSplit: (direction: SplitDirection, filePath?: string | null) => void;
  showMinimap: boolean;
  toggleMinimap: () => void;
};

export const createPanelsSlice: StateCreator<PanelsSlice, [], [], PanelsSlice> = (set) => {
  // The split view and file-editing mode are tied to the previous project's open
  // files. On project switch, collapse back to page mode with no split so the new
  // project doesn't inherit a split pointing at a file it doesn't have.
  registerProjectReset(() => {
    set({ mainView: 'page', splitDirection: 'none', splitFilePath: null });
  });

  return {
  projectTreeOpen: true,
  toggleProjectTree: () => set((s) => ({ projectTreeOpen: !s.projectTreeOpen })),
  projectTreeWidth: storage.get<number>('projectTreeWidth', PROJECT_TREE_WIDTH_DEFAULT),
  setProjectTreeWidth: (w) => {
    const clamped = Math.max(PROJECT_TREE_WIDTH_MIN, Math.min(PROJECT_TREE_WIDTH_MAX, w));
    storage.set('projectTreeWidth', clamped);
    set({ projectTreeWidth: clamped });
  },
  activeSidebarPanel: 'explorer',
  setActiveSidebarPanel: (panel) => set({ activeSidebarPanel: panel, projectTreeOpen: true }),
  bottomPanelOpen: false,
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
  bottomPanelHeight: storage.get<number>('bottomPanelHeight', BOTTOM_PANEL_HEIGHT_DEFAULT),
  setBottomPanelHeight: (h) => {
    const clamped = Math.max(BOTTOM_PANEL_HEIGHT_MIN, Math.min(BOTTOM_PANEL_HEIGHT_MAX, h));
    storage.set('bottomPanelHeight', clamped);
    set({ bottomPanelHeight: clamped });
  },
  activeBottomTab: 'output',
  setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),
  agentPanelOpen: false,
  toggleAgentPanel: () => set((s) => ({ agentPanelOpen: !s.agentPanelOpen })),
  setAgentPanelOpen: (open) => set({ agentPanelOpen: open }),
  agentPanelWidth: storage.get<number>('agentPanelWidth', AGENT_PANEL_WIDTH_DEFAULT),
  setAgentPanelWidth: (w) => {
    const clamped = Math.max(AGENT_PANEL_WIDTH_MIN, Math.min(AGENT_PANEL_WIDTH_MAX, w));
    storage.set('agentPanelWidth', clamped);
    set({ agentPanelWidth: clamped });
  },
  activePage: storage.get<ActivePage>('activePage', 'overview'),
  setActivePage: (page) => { storage.set('activePage', page); set({ activePage: page, mainView: 'page' }); },
  mainView: 'page' as MainView,
  setMainView: (view) => set({ mainView: view }),
  splitDirection: 'none',
  splitFilePath: null,
  setSplit: (direction, filePath) => set({ splitDirection: direction, splitFilePath: filePath ?? null }),
  showMinimap: false,
  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
  };
};
