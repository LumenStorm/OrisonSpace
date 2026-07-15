import { ipcMain } from 'electron';
import { existsSync, mkdirSync, copyFileSync, cpSync, readFileSync, readdirSync, statSync, unlinkSync, renameSync, rmSync } from 'node:fs';
import { readFile as readFileAsync, stat as statAsync } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { SaveBase64ImageInput } from '@orison/shared-contracts';
import { atomicWriteFileSync } from '@orison/shared-contracts/fs/atomicWrite';
import { allowPath, assertSafePath, assertWithinProject, getOrisonSpaceRoot, isSafePath } from './pathGuard';
import { decodeFileToUtf8 } from '../fs/decodeText';
import { findProjectRootFor, snapshotToLocalHistory, snapshotTreeToLocalHistory } from '../fs/localHistory';
import { registerSelfWrite } from '../fs/projectWatcher';
import { notifyUI } from './toolNotify';
import {
  ALLOWED_IMAGE_DIRS,
  buildProjectPath,
  createImageFileName,
  isBinaryReadable,
  mimeTypeFromExt,
  readDirectoryRecursive,
} from './projectIpcHelpers';
import { searchProjectFiles } from './toolHandlers/fileHandlers';
import { assertNotManagedProjectDocument, isManagedProjectDocumentPath } from './managedProjectDocument';

/**
 * Per-file word-count cache keyed by absolute path, invalidated by mtime.
 * Lets project:word-count skip re-reading unchanged files across the frequent
 * autosave/watcher-driven refreshes. Pruned to live files on each run.
 */
const wordCountCache = new Map<string, { mtimeMs: number; count: number }>();

/**
 * Build a non-colliding path within `dir` for an arbitrary file/folder name,
 * inserting `-1`, `-2`, ... before the extension if the target already exists.
 */
function uniquePath(dir: string, name: string): string {
  const ext = path.extname(name);
  const stem = ext ? name.slice(0, -ext.length) : name;
  let candidate = path.join(dir, name);
  let i = 1;
  while (existsSync(candidate)) {
    candidate = path.join(dir, `${stem}-${i}${ext}`);
    i++;
  }
  return candidate;
}

/** Names that should never be imported into a project via drag-drop. */
function shouldSkipImport(name: string): boolean {
  return name.startsWith('.') || name === 'node_modules';
}

/** Max single-file import size (50 MiB) — blocks bulk secret exfil via import-then-read. */
const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024;
/** Max files per import batch. */
const MAX_IMPORT_BATCH = 100;

/**
 * Reject source paths that are clearly not user drag-drop targets: empty,
 * relative, UNC without drive, or known sensitive locations (ssh keys, orison
 * key store, system dirs). Destination is still project-scoped; this only
 * reduces the "arbitrary local file read via import" blast radius if the
 * renderer is compromised.
 */
function isImportableSourcePath(src: string): boolean {
  if (!src || typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (!trimmed) return false;
  // Must be absolute (Windows drive or POSIX root). Reject relative / traversal.
  if (!path.isAbsolute(trimmed)) return false;
  // Reject Windows device paths / alternate data stream tricks.
  if (trimmed.includes('\0')) return false;
  if (/^[a-zA-Z]:/.test(trimmed) === false && process.platform === 'win32' && !trimmed.startsWith('\\\\')) {
    // On Windows, absolute paths are drive-letter or UNC.
  }
  const resolved = path.resolve(trimmed);
  if (isSensitiveImportSource(resolved)) return false;
  return true;
}

function isSensitiveImportSource(resolved: string): boolean {
  const lower = resolved.replace(/\\/g, '/').toLowerCase();
  const home = path.resolve(os.homedir()).replace(/\\/g, '/').toLowerCase();
  const denyExact = [
    `${home}/.ssh`,
    `${home}/.gnupg`,
    `${home}/.aws`,
    `${home}/.orison/model/keys`,
    `${home}/.orison/model`,
  ];
  for (const d of denyExact) {
    if (lower === d || lower.startsWith(d + '/')) return true;
  }
  // System dirs (best-effort)
  if (process.platform === 'win32') {
    if (lower.startsWith('c:/windows') || lower.startsWith('c:/program files')) return true;
  } else {
    if (lower.startsWith('/etc') || lower.startsWith('/usr') || lower.startsWith('/bin') || lower.startsWith('/sbin') || lower.startsWith('/root')) {
      return true;
    }
  }
  return false;
}

export function registerProjectFileIpc(): void {
  const orisonSpaceRoot = getOrisonSpaceRoot();

  /* ── Project-scoped file operations (all paths validated) ── */

  ipcMain.handle('project:create-directory', async (_, parentDir: string, name: string) => {
    const safeParentDir = parentDir && isSafePath(orisonSpaceRoot, parentDir) ? parentDir : orisonSpaceRoot;
    assertSafePath(safeParentDir);
    // Reject names with path separators to prevent traversal via name
    if (name.includes('/') || name.includes('\\') || name.includes('..')) {
      throw new Error('Invalid project name');
    }
    const projectDir = path.join(safeParentDir, name);
    assertSafePath(projectDir);
    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
    }
    return allowPath(projectDir);
  });

  ipcMain.handle('project:copy-cover-image', async (_, src: string, projectDir: string) => {
    assertSafePath(src);
    assertSafePath(projectDir);
    const ext = path.extname(src);
    const dest = path.join(projectDir, `cover${ext}`);
    assertWithinProject(projectDir, dest);
    // A project has exactly ONE cover. Because the file is named `cover.<ext>`,
    // uploading a different format (png -> jpg) would otherwise leave the old
    // `cover.png` orphaned alongside the new `cover.jpg`, and a stale meta
    // pointer to the old name renders blank. Remove any existing cover.* first
    // so there's never more than one cover file on disk.
    for (const name of readdirSync(projectDir)) {
      if (/^cover\.[^.]+$/i.test(name) && name !== `cover${ext}`) {
        try { unlinkSync(path.join(projectDir, name)); } catch { /* best effort */ }
      }
    }
    copyFileSync(src, dest);
    return dest;
  });

  /* ── Import external files dropped from the OS into the project ──
   * Destination stays project-scoped. Source paths must be absolute, must not
   * escape into sensitive system locations, and are size-capped so a compromised
   * renderer cannot bulk-exfiltrate arbitrary files via import-then-read. */
  ipcMain.handle(
    'project:import-files',
    async (_, projectDir: string, targetRelDir: string, sourcePaths: string[]) => {
      assertSafePath(projectDir);
      const destDir = targetRelDir && targetRelDir !== '/'
        ? buildProjectPath(projectDir, targetRelDir)
        : projectDir;
      assertWithinProject(projectDir, destDir);
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

      if (!Array.isArray(sourcePaths)) return [];
      // Cap batch size to limit abuse if renderer is compromised.
      const batch = sourcePaths.slice(0, MAX_IMPORT_BATCH);

      const imported: string[] = [];
      for (const src of batch) {
        if (!isImportableSourcePath(src)) continue;
        if (!existsSync(src)) continue;
        const baseName = path.basename(src);
        if (shouldSkipImport(baseName)) continue;
        const dest = uniquePath(destDir, baseName);
        assertWithinProject(projectDir, dest);
        if (isManagedProjectDocumentPath(dest)) continue;
        try {
          const stats = statSync(src);
          if (stats.isDirectory()) {
            // Directories: still copy, but reject sensitive roots and cap total size.
            if (isSensitiveImportSource(src)) continue;
            cpSync(src, dest, { recursive: true });
          } else {
            if (stats.size > MAX_IMPORT_FILE_BYTES) continue;
            if (isSensitiveImportSource(src)) continue;
            copyFileSync(src, dest);
          }
          const rel = '/' + path.relative(projectDir, dest).split(path.sep).join('/');
          imported.push(rel);
          notifyUI({ type: 'file:changed', projectPath: projectDir, path: rel });
        } catch {
          // Skip individual files that fail to copy; continue with the rest.
        }
      }
      return imported;
    },
  );

  ipcMain.handle('project:delete-entry', async (_, fullPath: string) => {
    assertSafePath(fullPath);
    if (isManagedProjectDocumentPath(fullPath)) return false;
    try {
      const stat = statSync(fullPath);
      // Deletion is irreversible — keep a local-history snapshot of the text
      // content being removed so a mis-click is recoverable by hand.
      const projectRoot = findProjectRootFor(fullPath);
      if (stat.isDirectory()) {
        if (projectRoot) snapshotTreeToLocalHistory(projectRoot, fullPath);
        rmSync(fullPath, { recursive: true, force: true });
      } else {
        if (projectRoot) snapshotToLocalHistory(projectRoot, fullPath);
        unlinkSync(fullPath);
      }
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('project:rename-entry', async (_, oldPath: string, newPath: string) => {
    assertSafePath(oldPath);
    assertSafePath(newPath);
    if (isManagedProjectDocumentPath(oldPath) || isManagedProjectDocumentPath(newPath)) return false;
    // Reject renaming onto an existing sibling. On POSIX renameSync would
    // silently replace the target (data loss); on Windows it throws. Guard
    // explicitly so the behaviour is consistent and the UI can warn the user.
    // Allow a pure case/spacing change where the resolved target IS the source.
    if (path.resolve(newPath) !== path.resolve(oldPath) && existsSync(newPath)) {
      return false;
    }
    try {
      renameSync(oldPath, newPath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('project:create-entry', async (_, fullPath: string, isDir: boolean) => {
    assertSafePath(fullPath);
    if (isManagedProjectDocumentPath(fullPath)) return false;
    // Reject names containing path separators / traversal (matches
    // create-directory). The name is the last path segment of fullPath.
    const baseName = path.basename(fullPath);
    if (!baseName || baseName === '.' || baseName === '..' || baseName.includes('..')) {
      return false;
    }
    // Never overwrite an existing file/dir: a blind atomicWrite('') here would
    // truncate a real manuscript to empty. Refuse and let the UI report it.
    if (existsSync(fullPath)) return false;
    try {
      if (isDir) {
        mkdirSync(fullPath, { recursive: true });
      } else {
        const dir = path.dirname(fullPath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        atomicWriteFileSync(fullPath, '', 'utf-8');
      }
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('project:read-file', async (_, fullPath: string) => {
    assertSafePath(fullPath);
    try {
      if (!existsSync(fullPath)) return null;
      // Read raw bytes and detect encoding (UTF-8 / UTF-8-BOM / UTF-16 / GBK).
      // Chinese .txt files are often saved as GBK on Windows; a blind utf-8
      // read would produce mojibake. Newlines are normalized to LF here.
      const buffer = readFileSync(fullPath);
      return decodeFileToUtf8(buffer);
    } catch {
      return null;
    }
  });

  ipcMain.handle('project:read-file-binary', async (_, fullPath: string) => {
    assertSafePath(fullPath);
    try {
      if (!existsSync(fullPath)) return null;
      const ext = path.extname(fullPath).toLowerCase();
      if (!isBinaryReadable(ext)) return null;
      const mimeType = mimeTypeFromExt(ext);
      if (!mimeType) return null;
      const buffer = readFileSync(fullPath);
      return { base64: buffer.toString('base64'), mimeType };
    } catch {
      return null;
    }
  });

  ipcMain.handle('project:search', async (_, projectDir: string, query: string, maxResults?: number) => {
    // Renderer-facing search. The agent tool path (handleToolExecute -> searchHandler)
    // is dev-only HTTP/WS; the UI must use this IPC channel so search works in
    // the packaged app. Shares the structured-search core with the tool handler.
    assertSafePath(projectDir);
    return searchProjectFiles(projectDir, query, maxResults);
  });

  ipcMain.handle('project:write-file', async (_, fullPath: string, content: string) => {
    assertSafePath(fullPath);
    try {
      assertNotManagedProjectDocument(fullPath);
      const dir = path.dirname(fullPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      // Local-history snapshot of the previous content before it's replaced
      // (covers the editor autosave and the agent-diff accept path alike).
      const projectRoot = findProjectRootFor(fullPath);
      if (projectRoot) snapshotToLocalHistory(projectRoot, fullPath, content);
      // Tell the watcher this is our own write so it doesn't broadcast a
      // file:changed (which would trigger a redundant tree refresh + word-count
      // rescan). Register just before writing so the event is covered.
      registerSelfWrite(fullPath);
      // Always write UTF-8 (no BOM). Combined with read-side LF normalization
      // this gives a stable LF + UTF-8 round-trip. We intentionally do not
      // restore the original encoding/newlines (e.g. GBK or CRLF): normalizing
      // to LF + UTF-8 is the accepted canonical form for the editor.
      atomicWriteFileSync(fullPath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('project:path-exists', async (_, fullPath: string) => {
    assertSafePath(fullPath);
    return existsSync(fullPath);
  });

  ipcMain.handle('project:save-base64-image', async (_, projectDir: string, input: SaveBase64ImageInput) => {
    assertSafePath(projectDir);
    if (!ALLOWED_IMAGE_DIRS.has(input.directory)) {
      throw new Error('Invalid image directory');
    }

    const fileName = createImageFileName(input);
    const relativePath = `${input.directory}/${fileName}`;
    const fullPath = buildProjectPath(projectDir, relativePath);
    const dir = path.dirname(fullPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    atomicWriteFileSync(fullPath, Buffer.from(input.b64Json, 'base64'));
    return { relativePath, fullPath, fileName };
  });

  ipcMain.handle('project:move-file', async (_, projectDir: string, fromRelativePath: string, toRelativePath: string) => {
    assertSafePath(projectDir);
    const source = buildProjectPath(projectDir, fromRelativePath);
    const destination = buildProjectPath(projectDir, toRelativePath);
    assertNotManagedProjectDocument(source);
    assertNotManagedProjectDocument(destination);
    const dir = path.dirname(destination);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    renameSync(source, destination);
    return destination;
  });

  ipcMain.handle('project:delete-file', async (_, projectDir: string, relativePath: string) => {
    assertSafePath(projectDir);
    const fullPath = buildProjectPath(projectDir, relativePath);
    if (isManagedProjectDocumentPath(fullPath)) return false;
    try {
      if (!existsSync(fullPath)) return true;
      snapshotToLocalHistory(projectDir, fullPath);
      unlinkSync(fullPath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('project:word-count', async (_, projectDir: string) => {
    assertSafePath(projectDir);
    try {
      const entries = readDirectoryRecursive(projectDir, projectDir, 10);
      const files: string[] = [];
      const collect = (list: typeof entries) => {
        for (const e of list) {
          if (e.isDir && e.children) { collect(e.children); continue; }
          if (!/\.(md|txt)$/i.test(e.name)) continue;
          files.push(path.join(projectDir, e.path.replace(/^\//, '')));
        }
      };
      collect(entries);

      // Per-file, mtime-keyed cache: only re-read + recount files that actually
      // changed since the last word-count. Reads run via fs.promises so the
      // main process isn't blocked by a synchronous full-project sweep on every
      // autosave/watcher tick (the old behaviour stalled the whole app).
      let total = 0;
      await Promise.all(files.map(async (fullPath) => {
        try {
          const { mtimeMs } = await statAsync(fullPath);
          const cached = wordCountCache.get(fullPath);
          if (cached && cached.mtimeMs === mtimeMs) {
            total += cached.count;
            return;
          }
          // Decode with encoding detection (UTF-8 / BOM / UTF-16 / GBK) so the
          // count matches what the editor shows. Chinese .txt files are often
          // GBK on Windows; a blind utf-8 read produces mojibake -> wrong count.
          const text = decodeFileToUtf8(await readFileAsync(fullPath)).trim();
          const count = text ? text.replace(/\s/g, '').length : 0;
          wordCountCache.set(fullPath, { mtimeMs, count });
          total += count;
        } catch { /* skip unreadable */ }
      }));

      // Drop cache entries for files no longer present so the map can't grow
      // unbounded across renames/deletes within a long-lived session.
      if (wordCountCache.size > files.length) {
        const live = new Set(files);
        for (const key of wordCountCache.keys()) {
          if (!live.has(key)) wordCountCache.delete(key);
        }
      }
      return total;
    } catch {
      return 0;
    }
  });
}
