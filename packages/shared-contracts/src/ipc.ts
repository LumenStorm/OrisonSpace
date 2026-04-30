import { z } from 'zod';

export const desktopIpcSchema = z.object({
  channel: z.enum(['project:pick-directory', 'config:load-model', 'config:save-model'])
});

/* ── Shared types ── */

export type ModelConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

/**
 * Canonical type for the preload API surface exposed via contextBridge.
 * Both `shell/preload/index.ts` and `ui/src/shared/preload.d.ts` must
 * reference this single source of truth.
 */
export type OrisonDesktopApi = {
  pickProjectDirectory(): Promise<string | null>;
  createProjectDirectory(parentDir: string, name: string): Promise<string>;
  pickCoverImage(): Promise<string | null>;
  copyCoverImage(src: string, projectDir: string): Promise<string>;
  saveProjectMeta(projectDir: string, meta: Record<string, unknown>): Promise<void>;
  loadProjectMeta(projectDir: string): Promise<Record<string, unknown> | null>;
  getLocale(): string;
  minimize(): void;
  maximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  platform: string;
  syncField(field: string, data: unknown): Promise<void>;
  loadModelConfig(): Promise<ModelConfig>;
  saveModelConfig(config: ModelConfig): Promise<void>;
  showItemInFolder(fullPath: string): void;
  openPath(fullPath: string): void;
  readDirectory(projectDir: string, maxDepth?: number): Promise<FileTreeEntry[]>;
  deleteEntry(fullPath: string): Promise<boolean>;
  renameEntry(oldPath: string, newPath: string): Promise<boolean>;
  createEntry(fullPath: string, isDir: boolean): Promise<boolean>;
  readFile(fullPath: string): Promise<string | null>;
  writeFile(fullPath: string, content: string): Promise<boolean>;
};

export type FileTreeEntry = {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileTreeEntry[];
};
