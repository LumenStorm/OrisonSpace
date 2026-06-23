import type { AssetRecord, SaveBase64ImageInput, SavedImageFile } from '@orison/shared-contracts';

const api = window.orisonDesktop;

export type DirEntry = { name: string; isDir: boolean; path?: string; children?: DirEntry[] };

export async function readAssetsDirectory(dir: string): Promise<DirEntry[]> {
  return (await api?.readDirectory(dir)) ?? [];
}

export async function listAssets(projectId: string): Promise<AssetRecord[]> {
  return (await api?.listAssets(projectId)) ?? [];
}

export async function upsertAsset(record: Partial<AssetRecord> & { assetId: string; projectId: string }): Promise<void> {
  await api?.upsertAsset(record as any);
}

export async function updateAsset(projectId: string, assetId: string, patch: { assetName?: string; assetGroup?: string; summary?: string }): Promise<void> {
  await api?.updateAsset(projectId, assetId, patch);
}

export async function deleteAsset(projectId: string, assetId: string): Promise<void> {
  await api?.deleteAsset(projectId, assetId);
}

/** Open a native picker to import external images into assets/images. Returns
 *  the relative paths imported. */
export async function importAssets(projectDir: string, projectId: string): Promise<string[]> {
  return (await api?.importAssets(projectDir, projectId)) ?? [];
}

export async function deleteEntry(path: string): Promise<void> {
  await api?.deleteEntry(path);
}

export async function pathExists(path: string): Promise<boolean> {
  return !!(await api?.pathExists(path));
}

export async function saveBase64Image(projectPath: string, opts: SaveBase64ImageInput): Promise<SavedImageFile> {
  return api!.saveBase64Image(projectPath, opts);
}

export function showItemInFolder(path: string): void {
  api?.showItemInFolder(path);
}
