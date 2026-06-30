import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  AssetRecord,
  AssetUpsertInput,
  GenerateImagePayload,
  GenerateTextPayload,
  GenerateVideoPayload,
  GitCommitEntry,
  GitFileDiff,
  ImportedFont,
  ImageGenerationResponse,
  ListRemoteModelsRequest,
  ModelConfig,
  OrisonDesktopApi,
  ProjectSearchResult,
  RegisteredProject,
  RemoteModel,
  RunStorySyncPayload,
  RunStorySyncResult,
  SaveBase64ImageInput,
  TaskRecord,
  TaskUpsertInput,
  TextGenerationResponse,
  UpdateCheckResult,
  UpdateEvent,
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
  importDocx: (projectDir: string) =>
    ipcRenderer.invoke('project:import-docx', projectDir) as Promise<string | null>,
  docxToHtml: (fullPath: string) =>
    ipcRenderer.invoke('project:docx-to-html', fullPath) as Promise<string | null>,
  docxToMarkdown: (fullPath: string) =>
    ipcRenderer.invoke('project:docx-to-markdown', fullPath) as Promise<string | null>,
  saveProjectMeta: (projectDir: string, meta: Record<string, unknown>) =>
    ipcRenderer.invoke('project:save-meta', projectDir, meta) as Promise<void>,
  ensureProjectDocument: (projectDir: string, meta: Record<string, unknown>) =>
    ipcRenderer.invoke('project:ensure-document', projectDir, meta) as Promise<void>,
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
  applyAgentFieldPatch: (projectPath: string, fieldPatch: unknown) =>
    ipcRenderer.invoke('field:apply-agent-patch', projectPath, fieldPatch) as Promise<unknown>,
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
  listImportedFonts: () =>
    ipcRenderer.invoke('config:list-imported-fonts') as Promise<ImportedFont[]>,
  importFonts: () => ipcRenderer.invoke('config:import-fonts') as Promise<ImportedFont[]>,
  showItemInFolder: (fullPath: string) => ipcRenderer.send('shell:show-item-in-folder', fullPath),
  openPath: (fullPath: string) => ipcRenderer.send('shell:open-path', fullPath),
  openExternal: (url: string) => ipcRenderer.send('shell:open-external', url),
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
  searchProject: (projectDir: string, query: string, maxResults?: number) =>
    ipcRenderer.invoke('project:search', projectDir, query, maxResults) as Promise<ProjectSearchResult[]>,
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
  // Drag-drop import of external OS files into the project tree
  importFiles: (projectDir: string, targetRelDir: string, sourcePaths: string[]) =>
    ipcRenderer.invoke('project:import-files', projectDir, targetRelDir, sourcePaths) as Promise<string[]>,
  // Resolve the absolute path of a dropped File (Electron 32+ removed File.path)
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  // Filesystem watcher for external-change auto-refresh
  watchProject: (projectDir: string) =>
    ipcRenderer.invoke('project:watch', projectDir) as Promise<void>,
  unwatchProject: () => ipcRenderer.invoke('project:unwatch') as Promise<void>,
  ensureProjectRegistration: (input: { name: string; type: 'novel' | 'script'; localFingerprint: string; path?: string; coverImage?: string }) =>
    ipcRenderer.invoke('project:ensure-registration', input) as Promise<{ projectId: string; name: string; type: string }>,
  listRegisteredProjects: () =>
    ipcRenderer.invoke('project:list-registered') as Promise<RegisteredProject[]>,
  touchProjectRegistration: (input: { localFingerprint: string; coverImage?: string }) =>
    ipcRenderer.invoke('project:touch-registration', input) as Promise<void>,
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
  importAssets: (projectDir: string, projectId: string) =>
    ipcRenderer.invoke('asset:import-files', projectDir, projectId) as Promise<string[]>,
  // Logging
  openLogsDir: () => ipcRenderer.invoke('log:open-dir') as Promise<string>,
  writeLog: (payload: { level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'; message: string; meta?: Record<string, unknown> }) =>
    ipcRenderer.invoke('log:write', payload) as Promise<void>,
  getAppVersion: () => ipcRenderer.invoke('app:get-version') as Promise<string>,
  checkForUpdate: () => ipcRenderer.invoke('update:check') as Promise<UpdateCheckResult>,
  downloadUpdate: () => ipcRenderer.invoke('update:download') as Promise<void>,
  installUpdate: () => ipcRenderer.invoke('update:install') as Promise<void>,
  onUpdateEvent: (callback: (event: UpdateEvent) => void) => {
    const listener = (_e: unknown, event: UpdateEvent) => callback(event);
    ipcRenderer.on('update:event', listener);
    return () => { ipcRenderer.removeListener('update:event', listener); };
  },
  gitIsRepo: (dir: string) => ipcRenderer.invoke('git:is-repo', dir) as Promise<boolean>,
  gitInit: (dir: string) => ipcRenderer.invoke('git:init', dir) as Promise<{ initialized: boolean }>,
  gitLog: (dir: string, depth?: number) => ipcRenderer.invoke('git:log', dir, depth) as Promise<GitCommitEntry[]>,
  gitCommitDiff: (dir: string, oid: string) => ipcRenderer.invoke('git:commit-diff', dir, oid) as Promise<GitFileDiff[]>,
  gitFileAtCommit: (dir: string, oid: string, filepath: string) => ipcRenderer.invoke('git:file-at-commit', dir, oid, filepath) as Promise<string | null>,
  gitCreateNode: (dir: string, message: string, tag?: string) => ipcRenderer.invoke('git:create-node', dir, message, tag) as Promise<{ oid: string }>,
  gitListBranches: (dir: string) => ipcRenderer.invoke('git:list-branches', dir) as Promise<string[]>,
  gitCurrentBranch: (dir: string) => ipcRenderer.invoke('git:current-branch', dir) as Promise<string>,
  gitCreateBranch: (dir: string, name: string, fromOid?: string) => ipcRenderer.invoke('git:create-branch', dir, name, fromOid) as Promise<void>,
  gitCheckoutBranch: (dir: string, name: string) => ipcRenderer.invoke('git:checkout-branch', dir, name) as Promise<void>,
  gitStatusCount: (dir: string) => ipcRenderer.invoke('git:status-count', dir) as Promise<number>,
  // Tool event notifications (pushed from Shell when Agent executes tools)
  onToolEvent: (callback: (data: { type: string; [key: string]: unknown }) => void) => {
    const listener = (_e: unknown, data: { type: string; [key: string]: unknown }) => callback(data);
    ipcRenderer.on('tool:event', listener);
    // Scoped removal: removeAllListeners would also kill any other subscriber on
    // this channel. Remove only the listener this subscription registered.
    return () => { ipcRenderer.removeListener('tool:event', listener); };
  },
  // Agent
  createAgentSession: (input: { agentName: string; projectPath: string; modelRef?: { keyId: string; modelId: string } }) =>
    ipcRenderer.invoke('agent:create-session', input),
  getAgentSession: (id: string, projectPath?: string) =>
    ipcRenderer.invoke('agent:get-session', id, projectPath),
  setAgentSessionModel: (sessionId: string, projectPath: string | undefined, modelRef: { keyId: string; modelId: string } | undefined) =>
    ipcRenderer.invoke('agent:set-session-model', sessionId, projectPath, modelRef),
  listAgentSessions: (projectPath?: string) =>
    ipcRenderer.invoke('agent:list-sessions', projectPath),
  deleteAgentSession: (id: string) =>
    ipcRenderer.invoke('agent:delete-session', id),
  streamAgentMessage: (input: { sessionId: string; content: string; attachments?: unknown[] }) =>
    ipcRenderer.invoke('agent:stream-message', input),
  onAgentStreamEvent: (callback: (event: { type: string; data: unknown }) => void) => {
    const listener = (_e: unknown, event: { type: string; data: unknown }) => callback(event);
    ipcRenderer.on('agent:stream-event', listener);
    return () => { ipcRenderer.removeListener('agent:stream-event', listener); };
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
  // Window lifecycle
  onBeforeClose: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('app:before-close', listener);
    return () => { ipcRenderer.removeListener('app:before-close', listener); };
  },
  confirmClose: () => ipcRenderer.send('app:close-confirmed'),
} satisfies OrisonDesktopApi;

contextBridge.exposeInMainWorld('orisonDesktop', exposedDesktopApi);
