import { closeSync, existsSync, fsyncSync, openSync, renameSync, rmSync, writeSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function atomicWriteFileSync(
  filePath: string,
  data: string | NodeJS.ArrayBufferView,
  encoding?: BufferEncoding,
): void {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${randomUUID()}`);
  try {
    // Write + fsync the temp file before renaming. Without the fsync, a crash
    // can land the rename before the data is flushed, leaving a zero-length
    // file. fsync guarantees the bytes are durable prior to the atomic swap.
    const buffer = typeof data === 'string' ? Buffer.from(data, encoding ?? 'utf-8') : data;
    const fd = openSync(tmpPath, 'w');
    try {
      writeSync(fd, buffer as NodeJS.ArrayBufferView);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmpPath, filePath);
  } catch (error) {
    if (existsSync(tmpPath)) rmSync(tmpPath, { force: true });
    throw error;
  }
}
