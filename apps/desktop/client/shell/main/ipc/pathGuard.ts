import os from 'node:os';
import path from 'node:path';

const ORISON_SPACE_ROOT = path.join(os.homedir(), 'Documents', 'OrisonSpace');
const allowedRoots = new Set([path.resolve(ORISON_SPACE_ROOT)]);

export function getOrisonSpaceRoot(): string {
  return ORISON_SPACE_ROOT;
}

export function isSafePath(base: string, target: string): boolean {
  const resolved = normalizeForCompare(path.resolve(target));
  const resolvedBase = normalizeForCompare(path.resolve(base));
  return resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep);
}

export function allowPath(target: string): string {
  const resolved = path.resolve(target);
  allowedRoots.add(resolved);
  return resolved;
}

export function assertSafePath(target: string): void {
  const resolved = path.resolve(target);
  const safe = [...allowedRoots].some((root) => isSafePath(root, resolved));
  if (!safe) {
    throw new Error(`Path outside allowed scope: ${resolved}`);
  }
}

export function assertWithinProject(projectDir: string, target: string): void {
  if (!isSafePath(projectDir, target)) {
    throw new Error(`Path escapes project directory: ${path.resolve(target)}`);
  }
}

function normalizeForCompare(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}
