import { z } from 'zod';
import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
  TextGenerationRequest,
  TextGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
} from './contracts/generation';
import type { ModelCapability, ModelConfig, DiscoveredModel } from './contracts/model';
import type { NovelStorySyncPayload } from './contracts/novel-orchestration';

export const desktopIpcSchema = z.object({
  channel: z.enum([
    'project:pick-directory',
    'config:load-model',
    'config:save-model',
    'config:load-user-preferences',
    'config:save-user-preferences',
    'model:list-remote-models',
    'model:generate-text',
    'model:generate-image',
    'model:generate-video',
    'storySync:run',
    'field:sync'
  ])
});

/* ── Shared types ── */

export type { ModelCapability, DiscoveredModel, ApiKeyConfig, ApiKeyEntry, ModelConfig, ResolvedModel } from './contracts/model';

/**
 * Request to list models from a remote endpoint.
 */
export type ListRemoteModelsRequest = {
  apiKey: string;
  baseUrl: string;
};

/**
 * A model discovered from the remote /v1/models endpoint.
 */
export type RemoteModel = {
  id: string;
  capability: ModelCapability;
  alias: string;
};

/* ── Generation IPC payloads ── */

/**
 * Model reference used in generation requests.
 * Points to a specific key + model combination.
 */
export type ModelRef = {
  keyId: string;
  modelId: string;
};

export type GenerateTextPayload = {
  ref: ModelRef;
  request: TextGenerationRequest;
};

export type GenerateImagePayload = {
  ref: ModelRef;
  request: ImageGenerationRequest;
};

export type GenerateVideoPayload = {
  ref: ModelRef;
  request: VideoGenerationRequest;
};

/**
 * Story-sync IPC payload.
 */
export type RunStorySyncPayload = {
  ref: ModelRef;
  runId: string;
  chapterId: string;
  candidate: Record<string, unknown>;
  context: Record<string, unknown>;
  fieldVersions: Partial<Record<string, number>>;
};

export type RunStorySyncResult = {
  patches: NovelStorySyncPayload['patches'];
  summary: string;
  fallbackToRules: boolean;
};

export type UserPreferencesConfig = {
  theme: string;
  locale: string;
  autoApplyPatches: boolean;
};

/**
 * Canonical type for the preload API surface exposed via contextBridge.
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
  listRemoteModels(request: ListRemoteModelsRequest): Promise<RemoteModel[]>;
  generateText(payload: GenerateTextPayload): Promise<TextGenerationResponse>;
  generateImage(payload: GenerateImagePayload): Promise<ImageGenerationResponse>;
  generateVideo(payload: GenerateVideoPayload): Promise<VideoGenerationResponse>;
  runStorySync(payload: RunStorySyncPayload): Promise<RunStorySyncResult>;
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
  pathExists(fullPath: string): Promise<boolean>;
  saveBase64Image(projectDir: string, input: SaveBase64ImageInput): Promise<SavedImageFile>;
  moveProjectFile(projectDir: string, fromRelativePath: string, toRelativePath: string): Promise<string>;
  deleteProjectFile(projectDir: string, relativePath: string): Promise<boolean>;
  ensureProjectRegistration(input: { name: string; type: 'novel' | 'script'; localFingerprint: string }): Promise<{ projectId: string; name: string; type: string }>;
  // Task persistence (SQLite)
  listTasks(projectId: string, limit?: number): Promise<TaskRecord[]>;
  upsertTask(input: TaskUpsertInput): Promise<void>;
  updateTaskStatus(taskId: string, status: string, errorMessage?: string): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
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
  directory: 'temp/images/generation' | 'assets/images';
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

/* ── Task persistence types ── */

export type TaskRecord = {
  taskId: string;
  projectId: string;
  taskType: string;
  name: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  errorMessage?: string;
  outputPayload?: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskUpsertInput = {
  taskId: string;
  projectId: string;
  taskType: string;
  name: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  errorMessage?: string;
  outputPayload?: string;
};
