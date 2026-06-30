import { closeSync, existsSync, fsyncSync, openSync, renameSync, rmSync, writeSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function renameWithRetry(from: string, to: string): void {
  const MAX_TRIES = 5;
  for (let attempt = 1; ; attempt++) {
    try {
      renameSync(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      const transient = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES';
      if (!transient || attempt >= MAX_TRIES) throw err;
      const until = Date.now() + attempt * 10;
      while (Date.now() < until) { /* spin */ }
    }
  }
}

export function atomicWriteFileSync(
  filePath: string,
  data: string | NodeJS.ArrayBufferView,
  encoding?: BufferEncoding,
): void {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${randomUUID()}`);
  try {
    const buffer = typeof data === 'string' ? Buffer.from(data, encoding ?? 'utf-8') : data;
    const fd = openSync(tmpPath, 'w');
    try {
      writeSync(fd, buffer as NodeJS.ArrayBufferView);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameWithRetry(tmpPath, filePath);
  } catch (error) {
    if (existsSync(tmpPath)) rmSync(tmpPath, { force: true });
    throw error;
  }
}
