import { contextBridge, ipcRenderer } from 'electron';
import type { OrisonDesktopApi, ModelConfig } from '@orison/shared-contracts';

export const exposedDesktopApi = {
  pickProjectDirectory: () => ipcRenderer.invoke('project:pick-directory'),
  createProjectDirectory: (parentDir: string, name: string) =>
    ipcRenderer.invoke('project:create-directory', parentDir, name) as Promise<string>,
  pickCoverImage: () => ipcRenderer.invoke('project:pick-cover-image') as Promise<string | null>,
  copyCoverImage: (src: string, projectDir: string) =>
    ipcRenderer.invoke('project:copy-cover-image', src, projectDir) as Promise<string>,
  saveProjectMeta: (projectDir: string, meta: Record<string, unknown>) =>
    ipcRenderer.invoke('project:save-meta', projectDir, meta) as Promise<void>,
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
  // 模型配置
  loadModelConfig: () => ipcRenderer.invoke('config:load-model') as Promise<ModelConfig>,
  saveModelConfig: (config: ModelConfig) => ipcRenderer.invoke('config:save-model', config) as Promise<void>,
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
  writeFile: (fullPath: string, content: string) =>
    ipcRenderer.invoke('project:write-file', fullPath, content) as Promise<boolean>,
} satisfies OrisonDesktopApi;

contextBridge.exposeInMainWorld('orisonDesktop', exposedDesktopApi);
