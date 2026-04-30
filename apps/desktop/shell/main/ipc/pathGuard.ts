import path from 'node:path';
import os from 'node:os';

/**
 * Validate that `target` is a descendant of (or equal to) `base`.
 * Prevents path-traversal attacks from the renderer.
 *
 * Both paths are resolved to absolute form before comparison,
 * so `../` sequences are neutralised.
 */
export function isSafePath(base: string, target: string): boolean {
  const resolved = path.resolve(target);
  const resolvedBase = path.resolve(base);
  return resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep);
}

/**
 * Allowed root directories for file operations.
 * A path must be a descendant of at least one of these.
 */
const ALLOWED_ROOTS = [
  os.homedir(),          // user home — covers project dirs & ~/.orison config
];

/**
 * Assert that a path is within an allowed root.
 * Throws if the path escapes all allowed roots.
 */
export function assertSafePath(target: string): void {
  const resolved = path.resolve(target);
  const safe = ALLOWED_ROOTS.some((root) => isSafePath(root, resolved));
  if (!safe) {
    throw new Error(`Path outside allowed scope: ${resolved}`);
  }
}

/**
 * Assert that a path is within a specific project directory.
 * Stricter than assertSafePath — used for project-scoped operations.
 */
export function assertWithinProject(projectDir: string, target: string): void {
  if (!isSafePath(projectDir, target)) {
    throw new Error(`Path escapes project directory: ${path.resolve(target)}`);
  }
}
