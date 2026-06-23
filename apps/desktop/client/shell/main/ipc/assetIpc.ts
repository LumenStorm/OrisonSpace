import { ipcMain, dialog } from 'electron';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { assetUpsertSchema, assetUpdateSchema, assetDeleteSchema } from '@orison/shared-contracts';
import { listAssets, upsertAsset, updateAsset, deleteAsset } from '../db/assetRepository';
import { assertSafePath, assertWithinProject } from './pathGuard';
import { notifyUI } from './toolNotify';
import { getLogger } from '../logger';

const ASSET_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];
const ASSETS_IMAGES_DIR = 'assets/images';

/** Pick a non-colliding filename in `dir` for `name` (foo.png → foo-1.png …). */
function uniqueFileName(dir: string, name: string): string {
  if (!existsSync(path.join(dir, name))) return name;
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  for (let i = 1; i < 1000; i++) {
    const candidate = `${base}-${i}${ext}`;
    if (!existsSync(path.join(dir, candidate))) return candidate;
  }
  return `${base}-${Date.now()}${ext}`;
}

export function registerAssetIpc() {
  ipcMain.handle('asset:list', async (_, projectId: string) => {
    return listAssets(projectId);
  });

  ipcMain.handle('asset:upsert', async (_, input: unknown) => {
    upsertAsset(assetUpsertSchema.parse(input));
  });

  ipcMain.handle('asset:update', async (_, projectId: string, assetId: string, fields: unknown) => {
    // Validate inputs (was previously trusted blindly, unlike asset:upsert).
    const parsed = assetUpdateSchema.parse({ projectId, assetId, fields });
    updateAsset(parsed.projectId, parsed.assetId, parsed.fields);
  });

  ipcMain.handle('asset:delete', async (_, projectId: string, assetId: string) => {
    const parsed = assetDeleteSchema.parse({ projectId, assetId });
    deleteAsset(parsed.projectId, parsed.assetId);
  });

  // Import external image files into the project's assets/images directory via a
  // native file picker, then register each as an asset. Returns the relative
  // paths actually imported.
  ipcMain.handle('asset:import-files', async (_, projectDir: string, projectId: string) => {
    assertSafePath(projectDir);
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ASSET_IMAGE_EXTS }],
    });
    if (result.canceled || result.filePaths.length === 0) return [];

    const destDir = path.join(projectDir, ASSETS_IMAGES_DIR);
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

    const imported: string[] = [];
    for (const src of result.filePaths) {
      const ext = path.extname(src).slice(1).toLowerCase();
      if (!ASSET_IMAGE_EXTS.includes(ext)) continue;
      try {
        const fileName = uniqueFileName(destDir, path.basename(src));
        const dest = path.join(destDir, fileName);
        assertWithinProject(projectDir, dest);
        copyFileSync(src, dest);
        const relativePath = `${ASSETS_IMAGES_DIR}/${fileName}`;
        if (projectId) {
          upsertAsset({
            assetId: randomUUID(),
            projectId,
            assetType: 'image',
            assetName: path.basename(fileName, path.extname(fileName)),
            assetGroup: '',
            relativePath,
          });
        }
        imported.push(relativePath);
      } catch (err) {
        getLogger().warn({ err: err instanceof Error ? err.message : String(err), src }, 'asset import failed');
      }
    }

    if (imported.length > 0) {
      notifyUI({ type: 'image:created', paths: imported });
    }
    return imported;
  });
}
