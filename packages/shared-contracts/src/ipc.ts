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
import type { NovelStorySyncPayload, NovelAutoModeState, NovelAutoModeStartRequest, NovelAutoModeAction, NovelChapterRunRequest } from './contracts/novel-orchestration';
import type { z as Z } from 'zod';
import type { orchestrationRunSchema, orchestrationActionSchema, startOrchestrationRunSchema } from './orchestration';

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
    'git:create-node',
    'git:list-branches',
    'git:current-branch',
    'git:create-branch',
    'git:checkout-branch',
    'project:ensure-registration',
    'project:list-registered',
    'project:touch-registration',
    'app:get-version',
    'update:check',
    'update:download',
    'update:install',
  ])
});

/* ── Skill Package types ── */

export type SkillPackageInfo = {
  name: string;
  path: string;
  enabled: boolean;
  skills: Array<{ name: string; description?: string; enabled: boolean }>;
};

/* ── Project registry (SQLite, ~/.orison) ── */

/**
 * A project registered in the local machine registry (`~/.orison/data/projects.db`).
 * This is the durable source of truth for "which projects exist on this machine",
 * surviving app version changes / reinstalls (unlike the localStorage recent list).
 */
export type RegisteredProject = {
  projectId: string;
  name: string;
  type: 'novel' | 'script';
  /** Absolute path to the project folder (also the registry's unique fingerprint). */
  path: string;
  coverImage?: string;
  /** ISO timestamp of the last time the project was opened. */
  lastOpenedAt?: string;
  createdAt: string;
  updatedAt: string;
};

/* ── Shared types ── */

export type { ModelCapability, DiscoveredModel, ApiKeyConfig, ApiKeyEntry, ModelConfig, ResolvedModel } from './contracts/model';

/**
 * Request to list models from a remote endpoint.
 */
export type ListRemoteModelsRequest = {
  keyId?: string;
  apiKey?: string;
  baseUrl?: string;
};

/**
 * A model discovered from the remote /v1/models endpoint.
 */
export type RemoteModel = {
  id: string;
  capability: ModelCapability;
  alias: string;
};

export type OrchestrationRun = Z.infer<typeof orchestrationRunSchema>;

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
  /** Whether to silently check for updates on startup. Defaults to true. */
  autoCheckUpdates?: boolean;
  /** @deprecated Custom manifest URL — superseded by the electron-updater GitHub feed. Read for back-compat only. */
  updateManifestUrl?: string;
  /** Reading font family for editor + agent panel body text. CSS font-family value or font stack name. */
  readingFontFamily?: string;
  /** Reading font weight for editor + agent panel body text (e.g. 400 / 500 / 600). */
  readingFontWeight?: number;
  /** Reading font scale multiplier for editor + agent panel body text (1 = default). */
  readingFontScale?: number;
};

/** A font file the user imported into the app's font folder. */
export type ImportedFont = {
  /** CSS font-family name (derived from the file stem). */
  family: string;
  /** `data:` URL of the font file, ready to feed an @font-face src. */
  dataUrl: string;
};

/* ── Update check IPC ── */

/** @deprecated Legacy custom-manifest shape — kept for type back-compat, no longer fetched. */
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
  | {
      status: 'available';
      currentVersion: string;
      latestVersion: string;
      /** True when the major version increased (current -> latest). Drives the prominent guided banner. */
      isMajor: boolean;
      releaseNotes?: string;
      /** Fallback download page, used by portable builds that cannot self-update. */
      downloadUrl?: string;
      /** True for portable/dir builds: no in-app download; user opens downloadUrl manually. */
      manual?: boolean;
    }
  | { status: 'not-configured' }
  /** Running unpackaged (dev) — electron-updater is unavailable. */
  | { status: 'dev'; currentVersion: string }
  | { status: 'error'; message: string };

/** Progressive update lifecycle events pushed from main -> renderer over `update:event`. */
export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; currentVersion: string; latestVersion: string; isMajor: boolean; releaseNotes?: string; manual?: boolean; downloadUrl?: string }
  | { type: 'not-available'; currentVersion: string }
  | { type: 'download-progress'; percent: number }
  | { type: 'downloaded'; latestVersion: string }
  | { type: 'error'; message: string };

/* ── Git IPC types ── */

export type GitCommitEntry = {
  oid: string;
  parents: string[];
  message: string;
  author: string;
  timestamp: number;
  tag?: string;
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
  importDocx(projectDir: string): Promise<string | null>;
  docxToHtml(fullPath: string): Promise<string | null>;
  docxToMarkdown(fullPath: string): Promise<string | null>;
  saveProjectMeta(projectDir: string, meta: Record<string, unknown>): Promise<void>;
  syncProjectMeta(projectDir: string, meta: Record<string, unknown>): Promise<void>;
  syncChaptersMeta(projectDir: string, chapters: Array<{ id: string; title: string; sort_order: number; status: string; summary?: string; summary_source?: string }>): Promise<void>;
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
  /** Enumerate fonts the user has imported into the app's font folder. */
  listImportedFonts(): Promise<ImportedFont[]>;
  /** Open a file picker, copy chosen font files into the app, return all imported fonts. */
  importFonts(): Promise<ImportedFont[]>;
  showItemInFolder(fullPath: string): void;
  openPath(fullPath: string): void;
  readDirectory(projectDir: string, maxDepth?: number): Promise<FileTreeEntry[]>;
  deleteEntry(fullPath: string): Promise<boolean>;
  renameEntry(oldPath: string, newPath: string): Promise<boolean>;
  createEntry(fullPath: string, isDir: boolean): Promise<boolean>;
  readFile(fullPath: string): Promise<string | null>;
  readFileBinary(fullPath: string): Promise<BinaryFilePayload | null>;
  writeFile(fullPath: string, content: string): Promise<boolean>;
  wordCount(projectDir: string): Promise<number>;
  pathExists(fullPath: string): Promise<boolean>;
  saveBase64Image(projectDir: string, input: SaveBase64ImageInput): Promise<SavedImageFile>;
  moveProjectFile(projectDir: string, fromRelativePath: string, toRelativePath: string): Promise<string>;
  deleteProjectFile(projectDir: string, relativePath: string): Promise<boolean>;
  importFiles(projectDir: string, targetRelDir: string, sourcePaths: string[]): Promise<string[]>;
  pathForFile(file: File): string;
  watchProject(projectDir: string): Promise<void>;
  unwatchProject(): Promise<void>;
  ensureProjectRegistration(input: { name: string; type: 'novel' | 'script'; localFingerprint: string; path?: string; coverImage?: string }): Promise<{ projectId: string; name: string; type: string }>;
  /** List every project registered on this machine (durable across version changes). */
  listRegisteredProjects(): Promise<RegisteredProject[]>;
  /** Bump last-opened time (and optionally cover image) for a registered project. */
  touchProjectRegistration(input: { localFingerprint: string; coverImage?: string }): Promise<void>;
  // Task persistence (SQLite)
  listTasks(projectId: string, limit?: number): Promise<TaskRecord[]>;
  upsertTask(input: TaskUpsertInput): Promise<void>;
  updateTaskStatus(taskId: string, status: string, errorMessage?: string): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  // Asset persistence (SQLite)
  listAssets(projectId: string): Promise<AssetRecord[]>;
  upsertAsset(input: AssetUpsertInput): Promise<void>;
  updateAsset(projectId: string, assetId: string, fields: Partial<Pick<AssetRecord, 'assetName' | 'assetGroup' | 'summary' | 'assetStatus'>>): Promise<void>;
  deleteAsset(projectId: string, assetId: string): Promise<void>;
  // Logging
  openLogsDir(): Promise<string>;
  writeLog(payload: { level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'; message: string; meta?: Record<string, unknown> }): Promise<void>;
  // Version + update
  getAppVersion(): Promise<string>;
  checkForUpdate(): Promise<UpdateCheckResult>;
  /** Begin downloading the available update (electron-updater). */
  downloadUpdate(): Promise<void>;
  /** Quit and install the downloaded update now. */
  installUpdate(): Promise<void>;
  /** Subscribe to update lifecycle events. Returns an unsubscribe fn. */
  onUpdateEvent(callback: (event: UpdateEvent) => void): () => void;
  // Git
  gitIsRepo(dir: string): Promise<boolean>;
  gitLog(dir: string, depth?: number): Promise<GitCommitEntry[]>;
  gitCommitDiff(dir: string, oid: string): Promise<GitFileDiff[]>;
  gitFileAtCommit(dir: string, oid: string, filepath: string): Promise<string | null>;
  gitCreateNode(dir: string, message: string, tag?: string): Promise<{ oid: string }>;
  gitListBranches(dir: string): Promise<string[]>;
  gitCurrentBranch(dir: string): Promise<string>;
  gitCreateBranch(dir: string, name: string, fromOid?: string): Promise<void>;
  gitCheckoutBranch(dir: string, name: string): Promise<void>;
  gitStatusCount(dir: string): Promise<number>;
  onToolEvent(callback: (data: { type: string; [key: string]: unknown }) => void): () => void;
  // Agent
  createAgentSession(input: { agentName: string; projectPath: string; modelRef?: { keyId: string; modelId: string } }): Promise<unknown>;
  getAgentSession(id: string, projectPath?: string): Promise<unknown>;
  setAgentSessionModel(sessionId: string, projectPath: string | undefined, modelRef: { keyId: string; modelId: string } | undefined): Promise<{ ok: boolean }>;
  listAgentSessions(projectPath?: string): Promise<unknown>;
  deleteAgentSession(id: string): Promise<boolean>;
  streamAgentMessage(input: { sessionId: string; content: string; attachments?: unknown[] }): Promise<{ status: string; message?: string }>;
  onAgentStreamEvent(callback: (event: { type: string; data: unknown }) => void): () => void;
  resolveAgentConfirmation(sessionId: string, callId: string, approved: boolean): Promise<unknown>;
  listAgentSkills(projectPath: string): Promise<unknown>;
  executeAgentSkill(sessionId: string, skillName: string, request?: unknown): Promise<unknown>;
  listAgentContinuations(sessionId: string): Promise<unknown>;
  restoreAgentContinuation(sessionId: string, continuationId: string): Promise<unknown>;
  abortAgentRun(sessionId: string): Promise<boolean>;
  // Skill package management
  listSkillPackages(projectPath?: string): Promise<SkillPackageInfo[]>;
  setPackageEnabled(packageName: string, enabled: boolean): Promise<{ ok: boolean }>;
  setSkillEnabled(packageName: string, skillName: string, enabled: boolean): Promise<{ ok: boolean }>;
  // Orchestration
  startOrchestrationRun(input: { projectPath: string; requirement: string; configRoot?: string }): Promise<OrchestrationRun>;
  getOrchestrationRun(runId: string): Promise<OrchestrationRun>;
  performOrchestrationAction(action: { runId: string; action: string; nodeId?: string; payload?: unknown }): Promise<OrchestrationRun>;
  // Auto Mode
  startAutoMode(input: { projectPath: string; mode?: string; chapterIds?: string[]; plotSummary?: string; modelRuntime?: unknown }): Promise<NovelAutoModeState>;
  performAutoModeAction(autoModeId: string, action: string): Promise<NovelAutoModeState>;
  getAutoModeState(autoModeId: string): Promise<NovelAutoModeState | null>;
  // Window lifecycle
  onBeforeClose(callback: () => void): () => void;
  confirmClose(): void;
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

export type AssetRecord = {
  assetId: string;
  projectId: string;
  assetType: string;
  assetName: string;
  assetGroup: string;
  assetStatus: string;
  relativePath: string;
  sourceTaskId?: string;
  summary?: string;
  version: number;
  updatedAt: string;
};

export type AssetUpsertInput = {
  assetId: string;
  projectId: string;
  assetType: string;
  assetName: string;
  assetGroup?: string;
  assetStatus?: string;
  relativePath: string;
  sourceTaskId?: string;
  summary?: string;
};
