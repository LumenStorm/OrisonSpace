import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { net } from 'electron';
import { assertSafePath } from './ipc/pathGuard';

export function resolveOrisonFilePath(url: string): string {
  const filePath = decodeURIComponent(new URL(url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
  const resolved = path.resolve(filePath);
  assertSafePath(resolved);
  return resolved;
}

export function fetchOrisonFile(url: string): Promise<Response> {
  const filePath = resolveOrisonFilePath(url);
  return net.fetch(pathToFileURL(filePath).toString());
}
