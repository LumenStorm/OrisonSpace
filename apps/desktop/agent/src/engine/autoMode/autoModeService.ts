import type { NovelAutoModeState } from '@orison/shared-contracts';
import { listProjectAutoModeStates } from './autoModeStore';

export function createAutoModeService() {
  const sessions = new Map<string, NovelAutoModeState>();

  return {
    getState(autoModeId: string): NovelAutoModeState | null {
      return sessions.get(autoModeId) ?? null;
    },

    register(state: NovelAutoModeState): void {
      sessions.set(state.autoModeId, state);
    },

    restoreFromProject(projectPath: string): NovelAutoModeState[] {
      const persisted = listProjectAutoModeStates(projectPath);
      for (const s of persisted) {
        if (!sessions.has(s.autoModeId)) {
          sessions.set(s.autoModeId, s);
        }
      }
      return [...sessions.values()].filter(s => s.projectPath === projectPath);
    },
  };
}
