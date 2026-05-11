import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import pino, { type TransportTargetOptions } from 'pino';
import { env } from './env';

function getLogFile(): string {
  const dir = path.resolve(process.cwd(), 'logs');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  return path.join(dir, `server-${today}.log`);
}

const isProd = process.env.NODE_ENV === 'production';

const targets: TransportTargetOptions[] = [
  {
    target: 'pino/file',
    level: env.LOG_LEVEL,
    options: { destination: getLogFile(), mkdir: true },
  },
];

if (!isProd) {
  targets.unshift({
    target: 'pino-pretty',
    level: env.LOG_LEVEL,
    options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
  });
}

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: { targets },
});
