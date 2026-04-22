import { dialog, ipcMain } from 'electron';

const allowedChannels = new Set(['project:pick-directory']);

export function registerProjectIpc() {
  if (!allowedChannels.has('project:pick-directory')) {
    throw new Error('IPC whitelist misconfigured');
  }

  ipcMain.handle('project:pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });

    return result.canceled ? null : result.filePaths[0];
  });
}
