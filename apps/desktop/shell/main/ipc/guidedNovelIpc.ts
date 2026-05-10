import { ipcMain } from 'electron';
import { guidedNovelProjectStateSchema } from '@orison/shared-contracts';
import { loadGuidedNovelState, saveGuidedNovelState } from '../../../local-bff/index';
import { assertSafePath } from './pathGuard';

export function registerGuidedNovelIpc() {
  ipcMain.handle('guidedNovel:load', async (_event, projectPath: string) => {
    assertSafePath(projectPath);
    return loadGuidedNovelState(projectPath);
  });

  ipcMain.handle('guidedNovel:save', async (_event, projectPath: string, state: unknown) => {
    assertSafePath(projectPath);
    saveGuidedNovelState(projectPath, guidedNovelProjectStateSchema.parse(state));
  });
}
