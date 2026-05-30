import type { BinaryFilePayload, FileTreeEntry, SaveBase64ImageInput, SavedImageFile } from '@orison/shared-contracts';

export type { FileTreeEntry, BinaryFilePayload, SavedImageFile };

const api = window.orisonDesktop;

export async function readDirectory(dir: string, depth?: number): Promise<FileTreeEntry[]> {
  return (await api?.readDirectory(dir, depth)) ?? [];
}

export async function readFileBinary(filePath: string): Promise<BinaryFilePayload | null> {
  return (await api?.readFileBinary(filePath)) ?? null;
}

export async function saveBase64Image(projectPath: string, opts: SaveBase64ImageInput): Promise<SavedImageFile> {
  return api!.saveBase64Image(projectPath, opts);
}

export async function moveProjectFile(projectPath: string, src: string, dest: string): Promise<void> {
  await api?.moveProjectFile(projectPath, src, dest);
}

export async function deleteProjectFile(projectPath: string, relativePath: string): Promise<void> {
  await api?.deleteProjectFile(projectPath, relativePath);
}
