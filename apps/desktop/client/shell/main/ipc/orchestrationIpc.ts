import { ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import type { NovelAutoModeState } from '@orison/shared-contracts';
import { getLogger } from '../logger';

interface OrchestrationRun {
  runId: string;
  status: string;
  currentNodeId: string | null;
  projectPath: string;
  completedNodes: string[];
  pendingNodes: string[];
  artifacts: Record<string, unknown>;
  review: unknown;
  archive: unknown;
  delivery: unknown;
  feedback: unknown;
}

const logger = getLogger();

const runs = new Map<string, OrchestrationRun>();
const autoModes = new Map<string, NovelAutoModeState>();

function createEmptyRun(projectPath: string, requirement: string): OrchestrationRun {
  return {
    runId: randomUUID(),
    status: 'pending',
    currentNodeId: null,
    projectPath,
    completedNodes: [],
    pendingNodes: [],
    artifacts: { requirement },
    review: null,
    archive: null,
    delivery: null,
    feedback: null,
  };
}

export function registerOrchestrationIpc() {
  ipcMain.handle('orchestration:start-run', async (_event, input: { projectPath: string; requirement: string; configRoot?: string }) => {
    const run = createEmptyRun(input.projectPath, input.requirement);
    runs.set(run.runId, run);
    logger.info({ runId: run.runId }, 'orchestration run created');
    return run;
  });

  ipcMain.handle('orchestration:get-run', async (_event, runId: string) => {
    const run = runs.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    return run;
  });

  ipcMain.handle('orchestration:action', async (_event, action: { runId: string; action: string; nodeId?: string; payload?: unknown }) => {
    const run = runs.get(action.runId);
    if (!run) throw new Error(`Run not found: ${action.runId}`);
    if (action.action === 'abort_run') {
      run.status = 'failed';
    }
    return run;
  });

  ipcMain.handle('orchestration:auto-mode-start', async (_event, input: { projectPath: string; mode?: string; chapterIds?: string[]; plotSummary?: string; modelRuntime?: unknown }) => {
    const state: NovelAutoModeState = {
      autoModeId: randomUUID(),
      projectPath: input.projectPath,
      status: 'planning',
      pendingChapterIds: input.chapterIds ?? [],
      completedChapterIds: [],
      currentChapterId: null,
      currentRunId: null,
      totalChapters: input.chapterIds?.length ?? 0,
      lastError: null,
      mode: (input.mode as 'generate' | 'continue' | 'polish') ?? 'generate',
      plotSummary: input.plotSummary,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    autoModes.set(state.autoModeId, state);
    logger.info({ autoModeId: state.autoModeId }, 'auto-mode started');
    return state;
  });

  ipcMain.handle('orchestration:auto-mode-action', async (_event, autoModeId: string, action: string) => {
    const state = autoModes.get(autoModeId);
    if (!state) throw new Error(`Auto-mode not found: ${autoModeId}`);
    switch (action) {
      case 'pause': state.status = 'paused'; break;
      case 'resume': state.status = 'running'; break;
      case 'cancel': state.status = 'cancelled'; break;
      case 'approve_plan': state.status = 'running'; break;
    }
    state.updatedAt = new Date().toISOString();
    return state;
  });

  ipcMain.handle('orchestration:auto-mode-get', async (_event, autoModeId: string) => {
    return autoModes.get(autoModeId) ?? null;
  });
}
