import type { StateCreator } from 'zustand';
import type {
  ContextRailTab,
  NovelObjectCategory,
  NovelWorkspaceRoute,
  SystemRailTab,
} from './types';

export type NovelWorkspaceState = {
  route: NovelWorkspaceRoute;
  objectCategory: NovelObjectCategory | null;
  activeObjectId: string | null;
  systemRailTab: SystemRailTab;
  contextRailTab: ContextRailTab;
};

export type NovelWorkspaceSlice = {
  novelWorkspace: NovelWorkspaceState;
  enterNovelWorkspace: () => void;
  openGuidedNovelWorkspace: () => void;
  selectNovelObjectCategory: (category: NovelObjectCategory) => void;
  selectNovelObject: (objectId: string | null) => void;
  setSystemRailTab: (tab: SystemRailTab) => void;
  setContextRailTab: (tab: ContextRailTab) => void;
};

const initialNovelWorkspaceState: NovelWorkspaceState = {
  route: 'home',
  objectCategory: null,
  activeObjectId: null,
  systemRailTab: 'tasks',
  contextRailTab: 'context',
};

export const createNovelWorkspaceSlice: StateCreator<
  NovelWorkspaceSlice,
  [],
  [],
  NovelWorkspaceSlice
> = (set) => ({
  novelWorkspace: initialNovelWorkspaceState,

  enterNovelWorkspace: () =>
    set((state) => ({
      novelWorkspace: {
        ...state.novelWorkspace,
        route: 'home',
      },
    })),

  openGuidedNovelWorkspace: () =>
    set((state) => ({
      novelWorkspace: {
        ...state.novelWorkspace,
        route: 'guided',
      },
    })),

  selectNovelObjectCategory: (category) =>
    set((state) => ({
      novelWorkspace: {
        ...state.novelWorkspace,
        route: 'objects',
        objectCategory: category,
        activeObjectId: null,
      },
    })),

  selectNovelObject: (objectId) =>
    set((state) => ({
      novelWorkspace: {
        ...state.novelWorkspace,
        activeObjectId: objectId,
      },
    })),

  setSystemRailTab: (tab) =>
    set((state) => ({
      novelWorkspace: {
        ...state.novelWorkspace,
        systemRailTab: tab,
      },
    })),

  setContextRailTab: (tab) =>
    set((state) => ({
      novelWorkspace: {
        ...state.novelWorkspace,
        contextRailTab: tab,
      },
    })),
});
