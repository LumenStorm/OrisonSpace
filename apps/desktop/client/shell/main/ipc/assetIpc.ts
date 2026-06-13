import { ipcMain } from 'electron';
import { assetUpsertSchema } from '@orison/shared-contracts';
import { listAssets, upsertAsset, updateAsset, deleteAsset } from '../db/assetRepository';

export function registerAssetIpc() {
  ipcMain.handle('asset:list', async (_, projectId: string) => {
    return listAssets(projectId);
  });

  ipcMain.handle('asset:upsert', async (_, input: unknown) => {
    upsertAsset(assetUpsertSchema.parse(input));
  });

  ipcMain.handle('asset:update', async (_, projectId: string, assetId: string, fields: {
    assetName?: string;
    assetGroup?: string;
    summary?: string;
    assetStatus?: string;
  }) => {
    updateAsset(projectId, assetId, fields);
  });

  ipcMain.handle('asset:delete', async (_, projectId: string, assetId: string) => {
    deleteAsset(projectId, assetId);
  });
}
