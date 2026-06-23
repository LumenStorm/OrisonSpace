import { closeSync, existsSync, fsyncSync, openSync, renameSync, rmSync, writeSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Rename with a short retry loop. On Windows the final rename can transiently
 * fail with EPERM/EBUSY when antivirus, the search indexer, or another handle
 * briefly holds the target file. A few spaced retries clear almost all of these
 * without surfacing a spurious write failure to the user.
 */
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
      // Brief synchronous backoff (10ms, 20ms, ...). atomicWriteFileSync is sync
      // by contract, so we busy-wait rather than await a timer.
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
    renameWithRetry(tmpPath, filePath);
  } catch (error) {
    if (existsSync(tmpPath)) rmSync(tmpPath, { force: true });
    throw error;
  }
}
