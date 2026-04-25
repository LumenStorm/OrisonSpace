import { contextBridge, ipcRenderer } from 'electron';

export const exposedDesktopApi = {
  pickProjectDirectory: () => ipcRenderer.invoke('project:pick-directory'),
  getLocale: () => navigator.language,
  // 窗口控制
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
  platform: process.platform,
  // 模型配置
  loadModelConfig: () => ipcRenderer.invoke('config:load-model') as Promise<{ apiKey: string; baseUrl: string; model: string }>,
  saveModelConfig: (config: { apiKey: string; baseUrl: string; model: string }) => ipcRenderer.invoke('config:save-model', config) as Promise<void>,
};

contextBridge.exposeInMainWorld('orisonDesktop', exposedDesktopApi);
