import { ipcMain } from 'electron';
import { deleteAssetArchive } from '../../../local-bff/index';
import { assertSafePath } from './pathGuard';

export function registerAssetArchiveIpc() {
  ipcMain.handle('assetArchive:delete', async (_event, projectPath: string, assetId: string) => {
    assertSafePath(projectPath);
    if (!assetId || typeof assetId !== 'string') {
      throw new Error('assetId is required');
    }

    deleteAssetArchive(projectPath, assetId);
  });
}
