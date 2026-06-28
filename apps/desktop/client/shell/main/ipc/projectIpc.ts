import { dialog, ipcMain } from 'electron';
import { existsSync, mkdirSync, copyFileSync, cpSync, readFileSync, readdirSync, statSync, unlinkSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { SaveBase64ImageInput } from '@orison/shared-contracts';
import { allowPath, assertSafePath, assertWithinProject, getOrisonSpaceRoot, isSafePath } from './pathGuard';
import { atomicWriteFileSync } from '../fs/atomicWrite';
import { decodeFileToUtf8 } from '../fs/decodeText';
import { watchProject, unwatchProject } from '../fs/projectWatcher';
import { withProjectLock } from '../fs/projectWriteLock';
import { getLogger } from '../logger';
import { notifyUI } from './toolNotify';
import { ensureProject, listProjects, touchProject } from '../db/projectRepository';
import {
  ALLOWED_IMAGE_DIRS,
  buildProjectPath,
  createImageFileName,
  isBinaryReadable,
  mimeTypeFromExt,
  readDirectoryRecursive,
} from './projectIpcHelpers';
import { searchProjectFiles } from './toolHandlers/fileHandlers';

/** 概览/创建传入的 camelCase meta（含 coverImage/projectId）映射进 project.yaml 的 meta（snake_case）。 */
const META_KEY_MAP: Record<string, string> = {
  name: 'name',
  type: 'type',
  logline: 'logline',
  synopsis: 'synopsis',
  genre: 'genre',
  theme: 'theme',
  writing_style: 'writing_style',
  writingStyle: 'writing_style',
  tone: 'tone',
  coverImage: 'cover_image',
  cover_image: 'cover_image',
  projectId: 'project_id',
  project_id: 'project_id',
};

/** 就地把传入 meta 合并进 project document 的 meta（空串/null 视为清空）。 */
function applyMetaToDocument(doc: Record<string, any>, meta: Record<string, unknown>): void {
  if (!doc.meta || typeof doc.meta !== 'object') doc.meta = {};
  for (const [inKey, value] of Object.entries(meta)) {
    const docKey = META_KEY_MAP[inKey];
    if (!docKey) continue; // chapters 等非 meta 字段不进 project.yaml meta
    if (docKey === 'name') {
      if (typeof value === 'string' && value.trim()) doc.meta.name = value;
    } else if (docKey === 'type') {
      if (value === 'script' || value === 'novel') doc.meta.type = value;
    } else if (value === undefined) {
      continue;
    } else {
      doc.meta[docKey] = value ? value : undefined;
    }
  }
}

/** project.yaml 的 meta（snake_case）回传成前端历史消费的 camelCase 形状（向后兼容）。 */
function projectMetaToLegacyShape(meta: Record<string, any>): Record<string, unknown> {
  return {
    ...meta,
    writingStyle: meta.writing_style,
    coverImage: meta.cover_image,
    projectId: meta.project_id,
  };
}

export function registerProjectIpc() {
  const orisonSpaceRoot = getOrisonSpaceRoot();
  if (!existsSync(orisonSpaceRoot)) {
    mkdirSync(orisonSpaceRoot, { recursive: true });
  }

  /* ── Dialog-based (user picks path via OS dialog — inherently safe) ── */

  ipcMain.handle('project:pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      defaultPath: orisonSpaceRoot,
      properties: ['openDirectory', 'createDirectory']
    });
    return result.canceled ? null : allowPath(result.filePaths[0]);
  });

  ipcMain.handle('project:pick-cover-image', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }
      ]
    });
    return result.canceled ? null : allowPath(result.filePaths[0]);
  });

  /* ── docx import / conversion ── */

  ipcMain.handle('project:import-docx', async (_, projectDir: string) => {
    assertSafePath(projectDir);
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Word', extensions: ['docx'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const src = result.filePaths[0];
    const markdown = await convertDocxToMarkdown(src);
    const baseName = path.basename(src, path.extname(src));
    const dest = uniqueMarkdownPath(projectDir, baseName);
    assertWithinProject(projectDir, dest);
    atomicWriteFileSync(dest, markdown, 'utf-8');
    const rel = '/' + path.relative(projectDir, dest).split(path.sep).join('/');
    notifyUI({ type: 'file:changed', path: rel });
    return rel;
  });

  ipcMain.handle('project:docx-to-html', async (_, fullPath: string) => {
    assertSafePath(fullPath);
    if (!existsSync(fullPath) || path.extname(fullPath).toLowerCase() !== '.docx') return null;
    try {
      const mammothMod = await import('mammoth');
      const mammoth = (mammothMod as { default?: unknown }).default ?? mammothMod;
      const { value } = await (mammoth as {
        convertToHtml: (i: { buffer: Buffer }) => Promise<{ value: string }>;
      }).convertToHtml({ buffer: readFileSync(fullPath) });
      return value;
    } catch {
      return null;
    }
  });

  ipcMain.handle('project:docx-to-markdown', async (_, fullPath: string) => {
    assertSafePath(fullPath);
    if (!existsSync(fullPath) || path.extname(fullPath).toLowerCase() !== '.docx') return null;
    const markdown = await convertDocxToMarkdown(fullPath);
    const dir = path.dirname(fullPath);
    const baseName = path.basename(fullPath, path.extname(fullPath));
    const dest = uniqueMarkdownPath(dir, baseName);
    assertSafePath(dest);
    atomicWriteFileSync(dest, markdown, 'utf-8');
    notifyUI({ type: 'file:changed', path: dest });
    return dest;
  });

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
    // uploading a different format (png → jpg) would otherwise leave the old
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
   * The DESTINATION is validated to stay within the project. The SOURCE paths
   * are NOT checked against the allowed-root scope: a drag-drop is the user's
   * explicit authorization to copy those arbitrary on-disk files in. We only
   * read (copy) them, never write to them. */
  ipcMain.handle(
    'project:import-files',
    async (_, projectDir: string, targetRelDir: string, sourcePaths: string[]) => {
      assertSafePath(projectDir);
      const destDir = targetRelDir && targetRelDir !== '/'
        ? buildProjectPath(projectDir, targetRelDir)
        : projectDir;
      assertWithinProject(projectDir, destDir);
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

      const imported: string[] = [];
      for (const src of sourcePaths) {
        if (!src || !existsSync(src)) continue;
        const baseName = path.basename(src);
        if (shouldSkipImport(baseName)) continue;
        const dest = uniquePath(destDir, baseName);
        assertWithinProject(projectDir, dest);
        try {
          const stats = statSync(src);
          if (stats.isDirectory()) {
            cpSync(src, dest, { recursive: true });
          } else {
            copyFileSync(src, dest);
          }
          const rel = '/' + path.relative(projectDir, dest).split(path.sep).join('/');
          imported.push(rel);
          notifyUI({ type: 'file:changed', path: rel });
        } catch {
          // Skip individual files that fail to copy; continue with the rest.
        }
      }
      return imported;
    },
  );


  ipcMain.handle('project:save-meta', async (_, projectDir: string, meta: Record<string, unknown>) => {
    assertSafePath(projectDir);
    // project.json 已废弃：meta 直接写入 project.yaml（唯一真相源）。沿用 sync-meta 的
    // 合并语义——load(或迁移/兜底重建) 后把传入字段并入 meta 再落盘。串行化防止与
    // sync-meta / sync-chapters-meta / 字段同步并发时互相覆盖（丢更新）。
    return withProjectLock(projectDir, async () => {
      const { loadProject, saveProject, createEmptyProjectDocument, migrateLegacyProjectJson } =
        await import('../../../../local-bff/index');
      const doc = migrateLegacyProjectJson(projectDir)
        ?? loadProject(projectDir)
        ?? createEmptyProjectDocument(
          typeof meta.name === 'string' && meta.name.trim() ? meta.name : path.basename(projectDir),
          meta.type === 'script' ? 'script' : 'novel',
        );
      const next = structuredClone(doc) as Record<string, any>;
      applyMetaToDocument(next, meta);
      next.meta.updated_at = new Date().toISOString();
      next.meta.version = (next.meta.version ?? 0) + 1;
      saveProject(projectDir, next as any);
    });
  });

  // Idempotent project.yaml initialization for create/import flows: guarantees
  // the config file exists without rewriting (or bumping version of) one that's
  // already there. Legacy project.json is migrated in if present.
  ipcMain.handle('project:ensure-document', async (_, projectDir: string, meta: Record<string, unknown>) => {
    assertSafePath(projectDir);
    return withProjectLock(projectDir, async () => {
      const { loadProject, saveProject, createEmptyProjectDocument, migrateLegacyProjectJson } =
        await import('../../../../local-bff/index');
      // Migration (if any) already lands a valid project.yaml on disk.
      if (migrateLegacyProjectJson(projectDir) ?? loadProject(projectDir)) return;
      // No document yet → create a fresh one seeded from the supplied meta.
      const doc = createEmptyProjectDocument(
        typeof meta.name === 'string' && meta.name.trim() ? meta.name : path.basename(projectDir),
        meta.type === 'script' ? 'script' : 'novel',
      );
      const next = structuredClone(doc) as Record<string, any>;
      applyMetaToDocument(next, meta);
      saveProject(projectDir, next as any);
    });
  });

  ipcMain.handle('project:load-meta', async (_, projectDir: string) => {
    assertSafePath(projectDir);
    try {
      const { migrateLegacyProjectJson } = await import('../../../../local-bff/index');
      // 打开旧项目时把残留 project.json 迁移进 project.yaml 并删除 json。
      const doc = migrateLegacyProjectJson(projectDir);
      if (!doc) return null;
      return projectMetaToLegacyShape(doc.meta);
    } catch {
      return null;
    }
  });

  ipcMain.handle('project:load-document', async (_, projectDir: string) => {
    assertSafePath(projectDir);
    try {
      const { loadProject } = await import('../../../../local-bff/index');
      return loadProject(projectDir) ?? null;
    } catch {
      return null;
    }
  });

  ipcMain.handle('project:sync-meta', async (_, projectDir: string, meta: Record<string, unknown>) => {
    assertSafePath(projectDir);
    return withProjectLock(projectDir, async () => {
      try {
        const { loadProject, saveProject, createEmptyProjectDocument, migrateLegacyProjectJson } =
          await import('../../../../local-bff/index');
        // project.yaml 是唯一真相源；缺失时迁移旧 json 或兜底重建，再写入概览元信息。
        const doc = migrateLegacyProjectJson(projectDir)
          ?? loadProject(projectDir)
          ?? createEmptyProjectDocument(
            typeof meta.name === 'string' && meta.name.trim() ? meta.name : path.basename(projectDir),
            meta.type === 'script' ? 'script' : 'novel',
          );
        const next = structuredClone(doc) as Record<string, any>;
        applyMetaToDocument(next, meta);
        next.meta.updated_at = new Date().toISOString();
        next.meta.version = (next.meta.version ?? 0) + 1;
        saveProject(projectDir, next as any);
        return { ok: true };
      } catch (err) {
        // Don't silently swallow: the renderer thought the save succeeded. Log it
        // and signal failure so the UI can warn the user / retry.
        const message = err instanceof Error ? err.message : String(err);
        getLogger().warn({ err: message, projectDir }, 'project:sync-meta failed');
        return { ok: false, error: message };
      }
    });
  });

  ipcMain.handle('project:sync-chapters-meta', async (_, projectDir: string, chapters: Array<{ id: string; title: string; sort_order: number; status: string; summary?: string; summary_source?: string }>) => {
    assertSafePath(projectDir);
    return withProjectLock(projectDir, async () => {
      try {
        const { loadProject, saveProject } = await import('../../../../local-bff/index');
        const doc = loadProject(projectDir);
        if (!doc) return { ok: false, error: 'project document not found' };
        const next = structuredClone(doc) as Record<string, any>;
        if (!next.novel) next.novel = { chapters: [] };
        next.novel.chapters = chapters.map((ch) => {
          const existing = (next.novel.chapters ?? []).find((e: any) => e.id === ch.id);
          return { ...existing, ...ch };
        });
        next.meta.version = (next.meta.version ?? 0) + 1;
        next.meta.updated_at = new Date().toISOString();
        saveProject(projectDir, next as any);
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        getLogger().warn({ err: message, projectDir }, 'project:sync-chapters-meta failed');
        return { ok: false, error: message };
      }
    });
  });

  ipcMain.handle('project:read-directory', async (_, projectDir: string, maxDepth = 5) => {
    assertSafePath(projectDir);
    if (!existsSync(projectDir)) return [];
    // Clamp maxDepth to prevent abuse
    const clampedDepth = Math.min(Math.max(maxDepth, 1), 8);
    return readDirectoryRecursive(projectDir, projectDir, clampedDepth);
  });

  ipcMain.handle('project:delete-entry', async (_, fullPath: string) => {
    assertSafePath(fullPath);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        rmSync(fullPath, { recursive: true, force: true });
      } else {
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
    // Renderer-facing search. The agent tool path (handleToolExecute → searchHandler)
    // is dev-only HTTP/WS; the UI must use this IPC channel so search works in
    // the packaged app. Shares the structured-search core with the tool handler.
    assertSafePath(projectDir);
    return searchProjectFiles(projectDir, query, maxResults);
  });

  ipcMain.handle('project:write-file', async (_, fullPath: string, content: string) => {
    assertSafePath(fullPath);
    try {
      const dir = path.dirname(fullPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
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
    const dir = path.dirname(destination);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    renameSync(source, destination);
    return destination;
  });

  ipcMain.handle('project:delete-file', async (_, projectDir: string, relativePath: string) => {
    assertSafePath(projectDir);
    const fullPath = buildProjectPath(projectDir, relativePath);
    try {
      if (!existsSync(fullPath)) return true;
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
      let total = 0;
      const countIn = (list: typeof entries) => {
        for (const e of list) {
          if (e.isDir && e.children) { countIn(e.children); continue; }
          if (!/\.(md|txt)$/i.test(e.name)) continue;
          const fullPath = path.join(projectDir, e.path.replace(/^\//, ''));
          try {
            // Decode with encoding detection (UTF-8 / BOM / UTF-16 / GBK) so the
            // count matches what the editor shows. Chinese .txt files are often
            // GBK on Windows; a blind utf-8 read produces mojibake → wrong count.
            const text = decodeFileToUtf8(readFileSync(fullPath)).trim();
            if (text) total += text.replace(/\s/g, '').length;
          } catch { /* skip unreadable */ }
        }
      };
      countIn(entries);
      return total;
    } catch {
      return 0;
    }
  });

  /* ── Local project registration (SQLite) ── */
  ipcMain.handle('project:ensure-registration', async (_, input: { name: string; type: 'novel' | 'script'; localFingerprint: string; path?: string; coverImage?: string }) => {
    const record = ensureProject(input);
    return { projectId: record.projectId, name: record.name, type: record.type };
  });

  // Durable project list for ProjectsPage (survives app version changes / reinstalls).
  ipcMain.handle('project:list-registered', async () => {
    return listProjects().map((r) => ({
      projectId: r.projectId,
      name: r.name,
      type: r.type,
      path: r.path ?? r.localFingerprint,
      coverImage: r.coverImage,
      lastOpenedAt: r.lastOpenedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  });

  ipcMain.handle('project:touch-registration', async (_, input: { localFingerprint: string; coverImage?: string }) => {
    touchProject(input);
  });

  /* ── Filesystem watcher (auto-refresh on external changes) ── */
  ipcMain.handle('project:watch', async (_, projectDir: string) => {
    watchProject(projectDir);
  });

  ipcMain.handle('project:unwatch', async () => {
    unwatchProject();
  });
}

/**
 * Convert a .docx file to Markdown. mammoth extracts the document body as HTML
 * (headings, bold/italic, lists, basic tables), then turndown maps it to
 * Markdown. Complex formatting (comments, advanced styles) is intentionally
 * dropped — prose-first conversion for a writing tool.
 */
async function convertDocxToMarkdown(fullPath: string): Promise<string> {
  const mammothMod = await import('mammoth');
  const mammoth = (mammothMod as { default?: unknown }).default ?? mammothMod;
  const { value: html } = await (mammoth as {
    convertToHtml: (i: { buffer: Buffer }) => Promise<{ value: string }>;
  }).convertToHtml({ buffer: readFileSync(fullPath) });

  const TurndownService = (await import('turndown')).default;
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  return turndown.turndown(html);
}

/**
 * Build a non-colliding `<base>.md` path within `dir`, appending `-1`, `-2`, …
 * if a file already exists.
 */
function uniqueMarkdownPath(dir: string, baseName: string): string {
  let candidate = path.join(dir, `${baseName}.md`);
  let i = 1;
  while (existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}-${i}.md`);
    i++;
  }
  return candidate;
}

/**
 * Build a non-colliding path within `dir` for an arbitrary file/folder name,
 * inserting `-1`, `-2`, … before the extension if the target already exists.
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
