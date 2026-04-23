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
};

contextBridge.exposeInMainWorld('orisonDesktop', exposedDesktopApi);
