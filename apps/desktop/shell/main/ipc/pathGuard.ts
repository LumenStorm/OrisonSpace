import os from 'node:os';
import path from 'node:path';

const ORISON_SPACE_ROOT = path.join(os.homedir(), 'Documents', 'OrisonSpace');
const ALLOWED_ROOTS = [ORISON_SPACE_ROOT];

export function getOrisonSpaceRoot(): string {
  return ORISON_SPACE_ROOT;
}

export function isSafePath(base: string, target: string): boolean {
  const resolved = path.resolve(target);
  const resolvedBase = path.resolve(base);
  return resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep);
}

export function assertSafePath(target: string): void {
  const resolved = path.resolve(target);
  const safe = ALLOWED_ROOTS.some((root) => isSafePath(root, resolved));
  if (!safe) {
    throw new Error(`Path outside allowed scope: ${resolved}`);
  }
}

export function assertWithinProject(projectDir: string, target: string): void {
  if (!isSafePath(projectDir, target)) {
    throw new Error(`Path escapes project directory: ${path.resolve(target)}`);
  }
}
