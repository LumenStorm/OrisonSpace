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
/** Relative paths (POSIX, leading '/') changed since the last flush. */
const pendingPaths = new Set<string>();

const DEBOUNCE_MS = 300;

/** Directory/file names whose changes should not trigger a tree refresh. */
function isNoise(changedPath: string | null): boolean {
  if (!changedPath) return false;
  const segments = changedPath.split(/[/\\]/);
  return segments.some(
    (seg) => seg.startsWith('.') || seg === 'node_modules',
  );
}

/** Normalize a watcher-reported filename to a project-relative POSIX path. */
function toRelPath(filename: string): string {
  const posix = filename.replace(/\\/g, '/').replace(/^\/+/, '');
  return `/${posix}`;
}

function scheduleNotify() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const paths = [...pendingPaths];
    pendingPaths.clear();
    // Emit the concrete changed paths so the renderer can reload exactly the
    // affected open tabs (and detect external edits/deletes). An empty `paths`
    // (filename unavailable on some platforms) still triggers a tree rescan.
    notifyUI({ type: 'file:changed', path: paths[0] ?? '', paths });
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
      if (name) pendingPaths.add(toRelPath(name));
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
  pendingPaths.clear();
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
