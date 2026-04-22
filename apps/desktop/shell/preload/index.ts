import { contextBridge, ipcRenderer } from 'electron';

export const exposedDesktopApi = {
  pickProjectDirectory: () => ipcRenderer.invoke('project:pick-directory')
};

contextBridge.exposeInMainWorld('orisonDesktop', exposedDesktopApi);
