import { ipcMain, shell } from 'electron';
import { getLogger, getLogsDirPath } from '../logger';

type RendererLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const VALID_LEVELS: Set<RendererLogLevel> = new Set(['debug', 'info', 'warn', 'error', 'fatal']);

export function registerLogIpc() {
  const logger = getLogger().child({ source: 'renderer' });

  ipcMain.handle('log:open-dir', async () => {
    const dir = getLogsDirPath();
    return shell.openPath(dir);
  });

  ipcMain.handle(
    'log:write',
    async (_evt, payload: { level: string; message: string; meta?: Record<string, unknown> }) => {
      const level = (VALID_LEVELS.has(payload.level as RendererLogLevel)
        ? payload.level
        : 'info') as RendererLogLevel;
      logger[level](payload.meta ?? {}, payload.message);
    },
  );
}
