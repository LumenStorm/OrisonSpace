import { contextBridge, ipcRenderer } from 'electron';
import type {
  AssetRecord,
  AssetUpsertInput,
  GenerateImagePayload,
  GenerateTextPayload,
  GenerateVideoPayload,
  GitCommitEntry,
  GitFileDiff,
  ImageGenerationResponse,
  ListRemoteModelsRequest,
  ModelConfig,
  OrisonDesktopApi,
  RemoteModel,
  RunStorySyncPayload,
  RunStorySyncResult,
  SaveBase64ImageInput,
  TaskRecord,
  TaskUpsertInput,
  TextGenerationResponse,
  UpdateCheckResult,
  UserPreferencesConfig,
  VideoGenerationResponse,
} from '@orison/shared-contracts';

export const exposedDesktopApi = {
  pickProjectDirectory: () => ipcRenderer.invoke('project:pick-directory'),
  createProjectDirectory: (parentDir: string, name: string) =>
    ipcRenderer.invoke('project:create-directory', parentDir, name) as Promise<string>,
  pickCoverImage: () => ipcRenderer.invoke('project:pick-cover-image') as Promise<string | null>,
  copyCoverImage: (src: string, projectDir: string) =>
    ipcRenderer.invoke('project:copy-cover-image', src, projectDir) as Promise<string>,
  saveProjectMeta: (projectDir: string, meta: Record<string, unknown>) =>
    ipcRenderer.invoke('project:save-meta', projectDir, meta) as Promise<void>,
  syncProjectMeta: (projectDir: string, meta: Record<string, unknown>) =>
    ipcRenderer.invoke('project:sync-meta', projectDir, meta) as Promise<void>,
  syncChaptersMeta: (projectDir: string, chapters: Array<{ id: string; title: string; sort_order: number; status: string; summary?: string; summary_source?: string }>) =>
    ipcRenderer.invoke('project:sync-chapters-meta', projectDir, chapters) as Promise<void>,
  loadProjectMeta: (projectDir: string) =>
    ipcRenderer.invoke('project:load-meta', projectDir) as Promise<Record<string, unknown> | null>,
  getLocale: () => navigator.language,
  // 窗口控制
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
  platform: process.platform,
  // 字段同步
  syncField: (projectPath: string, field: string, data: unknown) =>
    ipcRenderer.invoke('field:sync', projectPath, field, data) as Promise<void>,
  loadProjectDocument: (projectDir: string) =>
    ipcRenderer.invoke('project:load-document', projectDir) as Promise<Record<string, unknown> | null>,
  // 模型配置
  loadModelConfig: () => ipcRenderer.invoke('config:load-model') as Promise<ModelConfig>,
  saveModelConfig: (config: ModelConfig) => ipcRenderer.invoke('config:save-model', config) as Promise<void>,
  listRemoteModels: (request: ListRemoteModelsRequest) =>
    ipcRenderer.invoke('model:list-remote-models', request) as Promise<RemoteModel[]>,
  // 模型生成（desktop main 直连 provider）
  generateText: (payload: GenerateTextPayload) =>
    ipcRenderer.invoke('model:generate-text', payload) as Promise<TextGenerationResponse>,
  generateImage: (payload: GenerateImagePayload) =>
    ipcRenderer.invoke('model:generate-image', payload) as Promise<ImageGenerationResponse>,
  generateVideo: (payload: GenerateVideoPayload) =>
    ipcRenderer.invoke('model:generate-video', payload) as Promise<VideoGenerationResponse>,
  // Story-sync 桥（renderer -> desktop main 调 LLM 提补丁）
  runStorySync: (payload: RunStorySyncPayload) =>
    ipcRenderer.invoke('storySync:run', payload) as Promise<RunStorySyncResult>,
  loadUserPreferences: () =>
    ipcRenderer.invoke('config:load-user-preferences') as Promise<UserPreferencesConfig>,
  saveUserPreferences: (config: UserPreferencesConfig) =>
    ipcRenderer.invoke('config:save-user-preferences', config) as Promise<void>,
  showItemInFolder: (fullPath: string) => ipcRenderer.send('shell:show-item-in-folder', fullPath),
  openPath: (fullPath: string) => ipcRenderer.send('shell:open-path', fullPath),
  // 文件树操作
  readDirectory: (projectDir: string, maxDepth?: number) =>
    ipcRenderer.invoke('project:read-directory', projectDir, maxDepth),
  deleteEntry: (fullPath: string) =>
    ipcRenderer.invoke('project:delete-entry', fullPath) as Promise<boolean>,
  renameEntry: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke('project:rename-entry', oldPath, newPath) as Promise<boolean>,
  createEntry: (fullPath: string, isDir: boolean) =>
    ipcRenderer.invoke('project:create-entry', fullPath, isDir) as Promise<boolean>,
  readFile: (fullPath: string) =>
    ipcRenderer.invoke('project:read-file', fullPath) as Promise<string | null>,
  readFileBinary: (fullPath: string) =>
    ipcRenderer.invoke('project:read-file-binary', fullPath) as Promise<{ base64: string; mimeType: string } | null>,
  writeFile: (fullPath: string, content: string) =>
    ipcRenderer.invoke('project:write-file', fullPath, content) as Promise<boolean>,
  wordCount: (projectDir: string) =>
    ipcRenderer.invoke('project:word-count', projectDir) as Promise<number>,
  pathExists: (fullPath: string) =>
    ipcRenderer.invoke('project:path-exists', fullPath) as Promise<boolean>,
  saveBase64Image: (projectDir: string, input: SaveBase64ImageInput) =>
    ipcRenderer.invoke('project:save-base64-image', projectDir, input),
  moveProjectFile: (projectDir: string, fromRelativePath: string, toRelativePath: string) =>
    ipcRenderer.invoke('project:move-file', projectDir, fromRelativePath, toRelativePath) as Promise<string>,
  deleteProjectFile: (projectDir: string, relativePath: string) =>
    ipcRenderer.invoke('project:delete-file', projectDir, relativePath) as Promise<boolean>,
  ensureProjectRegistration: (input: { name: string; type: 'novel' | 'script'; localFingerprint: string }) =>
    ipcRenderer.invoke('project:ensure-registration', input) as Promise<{ projectId: string; name: string; type: string }>,
  // Task persistence (SQLite)
  listTasks: (projectId: string, limit?: number) =>
    ipcRenderer.invoke('task:list', projectId, limit) as Promise<TaskRecord[]>,
  upsertTask: (input: TaskUpsertInput) =>
    ipcRenderer.invoke('task:upsert', input) as Promise<void>,
  updateTaskStatus: (taskId: string, status: string, errorMessage?: string) =>
    ipcRenderer.invoke('task:update-status', taskId, status, errorMessage) as Promise<void>,
  deleteTask: (taskId: string) =>
    ipcRenderer.invoke('task:delete', taskId) as Promise<void>,
  // Asset persistence (SQLite)
  listAssets: (projectId: string) =>
    ipcRenderer.invoke('asset:list', projectId) as Promise<AssetRecord[]>,
  upsertAsset: (input: AssetUpsertInput) =>
    ipcRenderer.invoke('asset:upsert', input) as Promise<void>,
  updateAsset: (projectId: string, assetId: string, fields: Partial<Pick<AssetRecord, 'assetName' | 'assetGroup' | 'summary' | 'assetStatus'>>) =>
    ipcRenderer.invoke('asset:update', projectId, assetId, fields) as Promise<void>,
  deleteAsset: (projectId: string, assetId: string) =>
    ipcRenderer.invoke('asset:delete', projectId, assetId) as Promise<void>,
  // Logging
  openLogsDir: () => ipcRenderer.invoke('log:open-dir') as Promise<string>,
  writeLog: (payload: { level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'; message: string; meta?: Record<string, unknown> }) =>
    ipcRenderer.invoke('log:write', payload) as Promise<void>,
  getAppVersion: () => ipcRenderer.invoke('app:get-version') as Promise<string>,
  checkForUpdate: () => ipcRenderer.invoke('update:check') as Promise<UpdateCheckResult>,
  gitIsRepo: (dir: string) => ipcRenderer.invoke('git:is-repo', dir) as Promise<boolean>,
  gitLog: (dir: string, depth?: number) => ipcRenderer.invoke('git:log', dir, depth) as Promise<GitCommitEntry[]>,
  gitCommitDiff: (dir: string, oid: string) => ipcRenderer.invoke('git:commit-diff', dir, oid) as Promise<GitFileDiff[]>,
  gitFileAtCommit: (dir: string, oid: string, filepath: string) => ipcRenderer.invoke('git:file-at-commit', dir, oid, filepath) as Promise<string | null>,
  gitCreateNode: (dir: string, message: string, tag?: string) => ipcRenderer.invoke('git:create-node', dir, message, tag) as Promise<{ oid: string }>,
  gitListBranches: (dir: string) => ipcRenderer.invoke('git:list-branches', dir) as Promise<string[]>,
  gitCurrentBranch: (dir: string) => ipcRenderer.invoke('git:current-branch', dir) as Promise<string>,
  gitCreateBranch: (dir: string, name: string, fromOid?: string) => ipcRenderer.invoke('git:create-branch', dir, name, fromOid) as Promise<void>,
  gitCheckoutBranch: (dir: string, name: string) => ipcRenderer.invoke('git:checkout-branch', dir, name) as Promise<void>,
  // Tool event notifications (pushed from Shell when Agent executes tools)
  onToolEvent: (callback: (data: { type: string; [key: string]: unknown }) => void) => {
    ipcRenderer.on('tool:event', (_e, data) => callback(data));
    return () => { ipcRenderer.removeAllListeners('tool:event'); };
  },
  // Agent
  createAgentSession: (input: { agentName: string; projectPath: string; modelRef?: { keyId: string; modelId: string } }) =>
    ipcRenderer.invoke('agent:create-session', input),
  getAgentSession: (id: string, projectPath?: string) =>
    ipcRenderer.invoke('agent:get-session', id, projectPath),
  listAgentSessions: (projectPath?: string) =>
    ipcRenderer.invoke('agent:list-sessions', projectPath),
  deleteAgentSession: (id: string) =>
    ipcRenderer.invoke('agent:delete-session', id),
  streamAgentMessage: (input: { sessionId: string; content: string }) =>
    ipcRenderer.invoke('agent:stream-message', input),
  onAgentStreamEvent: (callback: (event: { type: string; data: unknown }) => void) => {
    ipcRenderer.on('agent:stream-event', (_e, event) => callback(event));
    return () => { ipcRenderer.removeAllListeners('agent:stream-event'); };
  },
  resolveAgentConfirmation: (sessionId: string, callId: string, approved: boolean) =>
    ipcRenderer.invoke('agent:resolve-confirmation', sessionId, callId, approved),
  listAgentSkills: (projectPath: string) =>
    ipcRenderer.invoke('agent:list-skills', projectPath),
  executeAgentSkill: (sessionId: string, skillName: string, request?: unknown) =>
    ipcRenderer.invoke('agent:execute-skill', sessionId, skillName, request),
  listAgentContinuations: (sessionId: string) =>
    ipcRenderer.invoke('agent:list-continuations', sessionId),
  restoreAgentContinuation: (sessionId: string, continuationId: string) =>
    ipcRenderer.invoke('agent:restore-continuation', sessionId, continuationId),
  abortAgentRun: (sessionId: string) =>
    ipcRenderer.invoke('agent:abort-run', sessionId),
  // Skill package management
  listSkillPackages: (projectPath?: string) =>
    ipcRenderer.invoke('agent:list-skill-packages', projectPath),
  setPackageEnabled: (packageName: string, enabled: boolean) =>
    ipcRenderer.invoke('agent:set-package-enabled', packageName, enabled),
  setSkillEnabled: (packageName: string, skillName: string, enabled: boolean) =>
    ipcRenderer.invoke('agent:set-skill-enabled', packageName, skillName, enabled),
  // Orchestration
  startOrchestrationRun: (input: { projectPath: string; requirement: string; configRoot?: string }) =>
    ipcRenderer.invoke('orchestration:start-run', input),
  getOrchestrationRun: (runId: string) =>
    ipcRenderer.invoke('orchestration:get-run', runId),
  performOrchestrationAction: (action: { runId: string; action: string; nodeId?: string; payload?: unknown }) =>
    ipcRenderer.invoke('orchestration:action', action),
  // Auto Mode
  startAutoMode: (input: { projectPath: string; mode?: string; chapterIds?: string[]; plotSummary?: string; modelRuntime?: unknown }) =>
    ipcRenderer.invoke('orchestration:auto-mode-start', input),
  performAutoModeAction: (autoModeId: string, action: string) =>
    ipcRenderer.invoke('orchestration:auto-mode-action', autoModeId, action),
  getAutoModeState: (autoModeId: string) =>
    ipcRenderer.invoke('orchestration:auto-mode-get', autoModeId),
  // Window lifecycle
  onBeforeClose: (callback: () => void) => {
    ipcRenderer.on('app:before-close', () => callback());
    return () => { ipcRenderer.removeAllListeners('app:before-close'); };
  },
  confirmClose: () => ipcRenderer.send('app:close-confirmed'),
} satisfies OrisonDesktopApi;

contextBridge.exposeInMainWorld('orisonDesktop', exposedDesktopApi);
