/**
 * Project Watcher — watches the active project directory for filesystem changes
 * made outside the app (e.g. files added in Explorer/Finder, or by other tools)
 * and notifies the renderer so the project tree can refresh.
 *
 * A single project is watched at a time: starting a new watch closes the prior
 * one. Recursive `fs.watch` is supported natively on Windows and macOS (the app's
 * target platforms); on Linux it is not, in which case external-change refresh
 * degrades to the manual refresh button.
 */
import { watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { assertSafePath } from '../ipc/pathGuard';
import { notifyUI } from '../ipc/toolNotify';
import { getLogger } from '../logger';

let activeWatcher: FSWatcher | null = null;
let activeDir: string | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

const DEBOUNCE_MS = 300;

/** Directory/file names whose changes should not trigger a tree refresh. */
function isNoise(changedPath: string | null): boolean {
  if (!changedPath) return false;
  const segments = changedPath.split(/[/\\]/);
  return segments.some(
    (seg) => seg.startsWith('.') || seg === 'node_modules',
  );
}

function scheduleNotify() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    notifyUI({ type: 'file:changed', path: '' });
  }, DEBOUNCE_MS);
}

export function watchProject(projectDir: string): void {
  assertSafePath(projectDir);
  const resolved = path.resolve(projectDir);
  if (activeDir === resolved && activeWatcher) return;

  unwatchProject();

  try {
    activeWatcher = watch(resolved, { recursive: true }, (_event, filename) => {
      const name = typeof filename === 'string' ? filename : null;
      if (isNoise(name)) return;
      scheduleNotify();
    });
    activeDir = resolved;
    activeWatcher.on('error', (err) => {
      getLogger().warn({ projectDir: resolved, err }, 'project watcher error');
      unwatchProject();
    });
  } catch (err) {
    // Recursive watch unsupported (e.g. Linux) or transient failure: degrade to
    // the manual refresh button rather than crashing.
    getLogger().warn({ projectDir: resolved, err }, 'project watcher unavailable');
    activeWatcher = null;
    activeDir = null;
  }
}

export function unwatchProject(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (activeWatcher) {
    try {
      activeWatcher.close();
    } catch {
      // ignore close errors
    }
    activeWatcher = null;
    activeDir = null;
  }
}
