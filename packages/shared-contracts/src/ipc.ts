import { z } from 'zod';
import type {
  GenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResponse,
  TextGenerationRequest,
  TextGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
} from './contracts/generation';
import type {
  ModelCapability,
  ModelProfileV2,
  SlotAssignment,
  SlotAssignmentMap,
} from './contracts/model';
import type { NovelStorySyncPayload } from './contracts/novel-orchestration';

export const desktopIpcSchema = z.object({
  channel: z.enum([
    'project:pick-directory',
    'config:load-model',
    'config:save-model',
    'config:load-user-preferences',
    'config:save-user-preferences',
    'model:list-provider-models',
    'model:generate-text',
    'model:generate-image',
    'model:generate-video',
    'storySync:run',
    'field:sync'
  ])
});

/* ── Shared types ── */

export type ModelType = 'novel' | 'image' | 'video';
export type { ModelCapability, ModelEntry, ModelProfileV2, SlotAssignment, SlotAssignmentMap } from './contracts/model';

/**
 * v2 model profile, exposed to the renderer as `ModelProfile`.
 *
 * One profile carries a single (baseUrl, apiKey) credential pair plus a list
 * of model entries. Each entry has its own `apiFormat`, alias, and
 * capabilities, so a profile can serve `novel`, `image`, and `video` slots
 * simultaneously. The desktop main process performs migration from the
 * legacy v1 single-model shape on read.
 */
export type ModelProfile = ModelProfileV2;

/**
 * Per-slot model assignment.
 *
 * `null` means the slot has no model assigned. The pair carries both the
 * profile id and the model id within that profile, since one profile can
 * expose multiple models.
 */
export type ModelSlotConfig = SlotAssignment;

export type ModelConfig = {
  profiles: ModelProfile[];
  selected: SlotAssignmentMap;
};

/**
 * Per-model entry in `ProviderModelListRequest` responses. Kept simple — the
 * renderer adds `alias` and `apiFormat` per entry before saving the profile.
 */
export type ProviderModel = {
  id: string;
  capabilities: ModelCapability[];
};

export type ProviderModelListRequest = {
  provider: GenerationProvider;
  apiKey: string;
  baseUrl: string;
};

/* ── Generation IPC payloads ── */

export type GenerateRequestPayload<TRequest> = {
  slot: SlotAssignment;
  request: TRequest;
};

export type GenerateTextPayload = GenerateRequestPayload<TextGenerationRequest>;
export type GenerateImagePayload = GenerateRequestPayload<ImageGenerationRequest>;
export type GenerateVideoPayload = GenerateRequestPayload<VideoGenerationRequest>;

/**
 * Story-sync IPC payload — the renderer asks desktop main to run the LLM
 * story-sync extraction locally and ship back patches that can then be
 * embedded under `artifacts['chapter.llmPatches']` of an orchestration run.
 */
export type RunStorySyncPayload = {
  slot: SlotAssignment;
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
