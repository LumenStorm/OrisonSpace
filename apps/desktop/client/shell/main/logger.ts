import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pino from 'pino';

let _logger: pino.Logger | null = null;
let _logsDir: string | null = null;

function getLogsDir(): string {
  if (_logsDir) return _logsDir;
  const home = os.homedir();
  const dir = path.join(home, '.orison', 'logs');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  _logsDir = dir;
  return dir;
}

function getCurrentLogFile(): string {
  const dir = getLogsDir();
  const today = new Date().toISOString().slice(0, 10);
  return path.join(dir, `desktop-${today}.log`);
}

function buildLogger(): pino.Logger {
  const isDev = !!process.env.ELECTRON_RENDERER_URL;
  const fileDest = pino.destination({ dest: getCurrentLogFile(), mkdir: true, sync: false });
  const streams: pino.StreamEntry[] = [{ level: 'info', stream: fileDest }];
  if (isDev) {
    streams.push({
      level: 'debug',
      stream: pino.transport({
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
      }),
    });
  }
  return pino({ level: isDev ? 'debug' : 'info' }, pino.multistream(streams));
}

export function getLogger(): pino.Logger {
  if (!_logger) _logger = buildLogger();
  return _logger;
}

export function getLogsDirPath(): string {
  return getLogsDir();
}

export function installGlobalErrorHandlers(): void {
  const logger = getLogger();
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'unhandledRejection');
  });
}
