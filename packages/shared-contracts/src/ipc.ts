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
    'field:sync',
    'project:load-document',
    'git:is-repo',
    'git:log',
    'git:commit-diff',
    'git:file-at-commit',
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
  updateManifestUrl?: string;
};

/* ── Update check IPC ── */

export type UpdateManifest = {
  /** Latest available version (semver-like, e.g. "0.2.0"). */
  latestVersion: string;
  /** External URL the user follows to download the new build. */
  downloadUrl: string;
  /** Optional human-readable changelog. */
  releaseNotes?: string;
};

export type UpdateCheckResult =
  | { status: 'up-to-date'; currentVersion: string; latestVersion: string }
  | { status: 'available'; currentVersion: string; latestVersion: string; downloadUrl: string; releaseNotes?: string }
  | { status: 'not-configured' }
  | { status: 'error'; message: string };

/* ── Git IPC types ── */

export type GitCommitEntry = {
  oid: string;
  message: string;
  author: string;
  timestamp: number;
};

export type GitFileDiff = {
  filepath: string;
  status: 'added' | 'modified' | 'deleted';
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
  loadProjectDocument(projectDir: string): Promise<Record<string, unknown> | null>;
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
  // Logging
  openLogsDir(): Promise<string>;
  writeLog(payload: { level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'; message: string; meta?: Record<string, unknown> }): Promise<void>;
  // Version + update
  getAppVersion(): Promise<string>;
  checkForUpdate(): Promise<UpdateCheckResult>;
  // Git
  gitIsRepo(dir: string): Promise<boolean>;
  gitLog(dir: string, depth?: number): Promise<GitCommitEntry[]>;
  gitCommitDiff(dir: string, oid: string): Promise<GitFileDiff[]>;
  gitFileAtCommit(dir: string, oid: string, filepath: string): Promise<string | null>;
  onToolEvent(callback: (data: { type: string; [key: string]: unknown }) => void): () => void;
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
