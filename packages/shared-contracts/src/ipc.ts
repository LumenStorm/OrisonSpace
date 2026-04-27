import { z } from 'zod';

export const desktopIpcSchema = z.object({
  channel: z.enum(['project:pick-directory', 'config:load-model', 'config:save-model'])
});

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
  loadModelConfig(): Promise<{ apiKey: string; baseUrl: string; model: string }>;
  saveModelConfig(config: { apiKey: string; baseUrl: string; model: string }): Promise<void>;
};
