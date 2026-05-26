import { existsSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
    if (typeof data === 'string') {
      writeFileSync(tmpPath, data, encoding ?? 'utf-8');
    } else {
      writeFileSync(tmpPath, data);
    }
    renameSync(tmpPath, filePath);
  } catch (error) {
    if (existsSync(tmpPath)) rmSync(tmpPath, { force: true });
    throw error;
  }
}
