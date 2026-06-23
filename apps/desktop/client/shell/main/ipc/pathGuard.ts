import os from 'node:os';
import path from 'node:path';
import { realpathSync } from 'node:fs';

const ORISON_SPACE_ROOT = path.join(os.homedir(), 'Documents', 'OrisonSpace');
const allowedRoots = new Set([path.resolve(ORISON_SPACE_ROOT)]);

export function getOrisonSpaceRoot(): string {
  return ORISON_SPACE_ROOT;
}

/**
 * Resolve symlinks before scope checks. A lexical `path.resolve` alone lets a
 * symlink *inside* the project point outside it and still pass the prefix test,
 * so a write would follow the link out of scope. We realpath the deepest
 * existing ancestor (realpathSync throws on a not-yet-created file) and rejoin
 * the non-existent tail, which still catches a symlinked directory in the chain.
 */
function realResolve(target: string): string {
  let current = path.resolve(target);
  const tail: string[] = [];
  for (;;) {
    try {
      return path.join(realpathSync(current), ...tail.reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target); // reached root, nothing existed
      tail.push(path.basename(current));
      current = parent;
    }
  }
}

export function isSafePath(base: string, target: string): boolean {
  const resolved = normalizeForCompare(realResolve(target));
  const resolvedBase = normalizeForCompare(realResolve(base));
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
