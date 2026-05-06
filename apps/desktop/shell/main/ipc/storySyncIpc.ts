import { ipcMain } from 'electron';
import type { RunStorySyncPayload, RunStorySyncResult } from '@orison/shared-contracts';
import { runStorySync } from '../storySync';

/**
 * `storySync:run` — desktop renderer asks main to run the LLM-driven
 * story-sync extraction locally before submitting an orchestration run to
 * server. Result patches are then embedded under
 * `artifacts['chapter.llmPatches']` of the run body.
 */
export function registerStorySyncIpc() {
  ipcMain.handle('storySync:run', async (_event, payload: RunStorySyncPayload): Promise<RunStorySyncResult> => {
    return runStorySync(payload);
  });
}
