import { z } from 'zod';
import type { GenerationProvider } from './contracts/generation';

export const desktopIpcSchema = z.object({
  channel: z.enum([
    'project:pick-directory',
    'config:load-model',
    'config:save-model',
    'config:load-user-preferences',
    'config:save-user-preferences',
    'model:list-provider-models',
    'field:sync'
  ])
});

/* ── Shared types ── */

export type ModelType = 'novel' | 'image' | 'video';
export type ModelCapability = 'text' | 'image' | 'video';

export type ModelProfile = {
  id: string;
  name: string;
  provider: GenerationProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  capabilities: ModelCapability[];
};

export type ModelSlotConfig = {
  provider: GenerationProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type ModelConfig = {
  profiles: ModelProfile[];
  selected: Record<ModelType, string | null>;
};

export type ProviderModel = Pick<ModelProfile, 'id' | 'capabilities'>;

export type ProviderModelListRequest = Pick<ModelSlotConfig, 'provider' | 'apiKey' | 'baseUrl'>;

export type UserPreferencesConfig = {
  theme: string;
  locale: string;
  autoApplyPatches: boolean;
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
  syncField(projectPath: string, field: string, data: unknown): Promise<void>;
  loadModelConfig(): Promise<ModelConfig>;
  saveModelConfig(config: ModelConfig): Promise<void>;
  listProviderModels(request: ProviderModelListRequest): Promise<ProviderModel[]>;
  loadUserPreferences(): Promise<UserPreferencesConfig>;
  saveUserPreferences(config: UserPreferencesConfig): Promise<void>;
  showItemInFolder(fullPath: string): void;
  openPath(fullPath: string): void;
  readDirectory(projectDir: string, maxDepth?: number): Promise<FileTreeEntry[]>;
  deleteEntry(fullPath: string): Promise<boolean>;
  renameEntry(oldPath: string, newPath: string): Promise<boolean>;
  createEntry(fullPath: string, isDir: boolean): Promise<boolean>;
  readFile(fullPath: string): Promise<string | null>;
  readFileBinary(fullPath: string): Promise<BinaryFilePayload | null>;
  writeFile(fullPath: string, content: string): Promise<boolean>;
  saveBase64Image(projectDir: string, input: SaveBase64ImageInput): Promise<SavedImageFile>;
  moveProjectFile(projectDir: string, fromRelativePath: string, toRelativePath: string): Promise<string>;
  deleteProjectFile(projectDir: string, relativePath: string): Promise<boolean>;
};

export type FileTreeEntry = {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileTreeEntry[];
};

export type SaveBase64ImageInput = {
  b64Json: string;
  mimeType: string;
  directory: 'temp/images' | 'assets/images';
  fileName?: string;
};

export type SavedImageFile = {
  relativePath: string;
  fullPath: string;
  fileName: string;
};

/** Binary file payload returned by `project:read-file-binary`. */
export type BinaryFilePayload = {
  base64: string;
  mimeType: string;
};
