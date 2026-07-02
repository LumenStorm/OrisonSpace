/**
 * Local history — a last-resort safety net under `<project>/.orison/history/`.
 *
 * Before a manuscript file is overwritten or deleted, its current on-disk
 * content is copied to `.orison/history/<relative-path>/<timestamp>.<ext>`,
 * keeping the most recent KEEP_PER_FILE snapshots per file. This exists so a
 * bad overwrite (agent patch, restore, editor bug, dual-pane race) is
 * recoverable by hand even before a proper backup center ships. It is not a
 * backup system: snapshots are throttled, size-capped, and pruned.
 *
 * Everything here is best effort — history must never block or fail a save.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { atomicWriteFileSync } from '@orison/shared-contracts/fs/atomicWrite';

const ORISON_DIR = '.orison';
const HISTORY_DIR = 'history';
const KEEP_PER_FILE = 20;
/** Manuscript-like text files worth snapshotting. */
const TEXT_EXT_RE = /\.(md|txt|text|ya?ml)$/i;
/** History is a safety net, not a backup system — skip huge files. */
const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;
/**
 * Autosave fires every ~1.5s; snapshotting each save would cycle the whole
 * ring in 30 seconds. Same-file snapshots are throttled to this interval,
 * EXCEPT when the incoming write shrinks the file sharply (the dangerous
 * pattern: agent rewrite, lossy conversion, accidental clobber) or the file
 * is being deleted — those always snapshot.
 */
const MIN_INTERVAL_MS = 10 * 60 * 1000;
const SHRINK_FORCE_MIN_CHARS = 2000;
const SHRINK_FORCE_RATIO = 0.2;
/** Marker files that identify a project root (for walk-up detection). */
const ROOT_MARKERS = ['project.yaml', 'project.json'];
/** Cap for directory-delete snapshots so a huge tree can't stall the delete. */
const MAX_TREE_SNAPSHOT_FILES = 200;

/** Locate the project root for an absolute file path, or null when outside any project. */
export function findProjectRootFor(fullPath: string): string | null {
  let dir = path.dirname(path.resolve(fullPath));
  for (let hops = 0; hops < 40; hops++) {
    if (ROOT_MARKERS.some((m) => existsSync(path.join(dir, m)))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function ensureHistoryBase(projectRoot: string): string {
  const orisonDir = path.join(projectRoot, ORISON_DIR);
  const base = path.join(orisonDir, HISTORY_DIR);
  mkdirSync(base, { recursive: true });
  // Keep app metadata (and these snapshots) out of the user's version
  // timeline: without this, every autosave would dirty `git status`, trip the
  // unsaved-changes warnings, and embed the history tree in every version node.
  const ignorePath = path.join(orisonDir, '.gitignore');
  if (!existsSync(ignorePath)) atomicWriteFileSync(ignorePath, '*\n', 'utf-8');
  return base;
}

/**
 * Snapshot `fullPath`'s current content before it is overwritten or deleted.
 * Pass `nextContent` for overwrites (enables the shrink heuristic and the
 * throttle); omit it for deletes, which always snapshot.
 */
export function snapshotToLocalHistory(projectRoot: string, fullPath: string, nextContent?: string): void {
  try {
    const resolved = path.resolve(fullPath);
    if (!TEXT_EXT_RE.test(resolved)) return;
    if (!existsSync(resolved)) return; // brand-new file — nothing to preserve
    const rel = path.relative(path.resolve(projectRoot), resolved);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return;
    if (rel.split(path.sep)[0] === ORISON_DIR) return; // never snapshot our own metadata
    const stat = statSync(resolved);
    if (!stat.isFile() || stat.size > MAX_SNAPSHOT_BYTES) return;

    const destDir = path.join(ensureHistoryBase(projectRoot), rel);
    const existing = existsSync(destDir) ? readdirSync(destDir).sort() : [];

    if (nextContent !== undefined && existing.length > 0) {
      const newestAge = Date.now() - statSync(path.join(destDir, existing[existing.length - 1])).mtimeMs;
      const prevSize = stat.size;
      const shrink = prevSize - Buffer.byteLength(nextContent, 'utf-8');
      const dangerousShrink = shrink > Math.max(SHRINK_FORCE_MIN_CHARS, prevSize * SHRINK_FORCE_RATIO);
      if (newestAge < MIN_INTERVAL_MS && !dangerousShrink) return;
    }

    mkdirSync(destDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-'); // Windows-safe filename
    atomicWriteFileSync(path.join(destDir, `${stamp}${path.extname(resolved)}`), readFileSync(resolved));

    // Ring cleanup — ISO stamps sort chronologically.
    const all = readdirSync(destDir).sort();
    for (const name of all.slice(0, Math.max(0, all.length - KEEP_PER_FILE))) {
      try { unlinkSync(path.join(destDir, name)); } catch { /* best effort */ }
    }
  } catch {
    // Best-effort insurance: never let history break the write/delete path.
  }
}

/** Snapshot every text file under `dirPath` (bounded) before the tree is deleted. */
export function snapshotTreeToLocalHistory(projectRoot: string, dirPath: string): void {
  try {
    let budget = MAX_TREE_SNAPSHOT_FILES;
    const walk = (dir: string) => {
      if (budget <= 0) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (budget <= 0) return;
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (TEXT_EXT_RE.test(entry.name)) {
          budget--;
          snapshotToLocalHistory(projectRoot, full);
        }
      }
    };
    walk(path.resolve(dirPath));
  } catch {
    // Best effort.
  }
}
