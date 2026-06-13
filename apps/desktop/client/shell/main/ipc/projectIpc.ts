import { dialog, ipcMain } from 'electron';
import { existsSync, mkdirSync, copyFileSync, cpSync, readFileSync, statSync, unlinkSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { SaveBase64ImageInput } from '@orison/shared-contracts';
import { allowPath, assertSafePath, assertWithinProject, getOrisonSpaceRoot, isSafePath } from './pathGuard';
import { atomicWriteFileSync } from '../fs/atomicWrite';
import { decodeFileToUtf8 } from '../fs/decodeText';
import { watchProject, unwatchProject } from '../fs/projectWatcher';
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
    const metaPath = path.join(projectDir, 'project.json');
    assertWithinProject(projectDir, metaPath);
    atomicWriteFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  });

  ipcMain.handle('project:load-meta', async (_, projectDir: string) => {
    assertSafePath(projectDir);
    const metaPath = path.join(projectDir, 'project.json');
    assertWithinProject(projectDir, metaPath);
    try {
      if (!existsSync(metaPath)) return null;
      return JSON.parse(readFileSync(metaPath, 'utf-8'));
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
    try {
      const { loadProject, saveProject, bootstrapProjectFromMeta } = await import('../../../../local-bff/index');
      // project.yaml 缺失时不再静默放弃：从 project.json 兜底重建一个，再写入概览
      // 元信息。否则用户在概览页填的 logline/synopsis 等永远进不了 project.yaml，
      // 而 agent 工具读的是 project.yaml，会出现元信息漂移。
      const doc = loadProject(projectDir) ?? bootstrapProjectFromMeta(projectDir);
      const next = structuredClone(doc) as Record<string, any>;
      if (meta.name) next.meta.name = meta.name;
      if (meta.logline !== undefined) next.meta.logline = meta.logline || undefined;
      if (meta.synopsis !== undefined) next.meta.synopsis = meta.synopsis || undefined;
      if (meta.genre !== undefined) next.meta.genre = meta.genre || undefined;
      if (meta.theme !== undefined) next.meta.theme = meta.theme || undefined;
      if (meta.writing_style !== undefined) next.meta.writing_style = meta.writing_style || undefined;
      if (meta.tone !== undefined) next.meta.tone = meta.tone || undefined;
      next.meta.updated_at = new Date().toISOString();
      next.meta.version = (next.meta.version ?? 0) + 1;
      saveProject(projectDir, next as any);
    } catch { /* best-effort：project.json 也损坏时不阻断 project.json 的保存 */ }
  });

  ipcMain.handle('project:sync-chapters-meta', async (_, projectDir: string, chapters: Array<{ id: string; title: string; sort_order: number; status: string; summary?: string; summary_source?: string }>) => {
    assertSafePath(projectDir);
    try {
      const { loadProject, saveProject } = await import('../../../../local-bff/index');
      const doc = loadProject(projectDir);
      if (!doc) return;
      const next = structuredClone(doc) as Record<string, any>;
      if (!next.novel) next.novel = { chapters: [] };
      next.novel.chapters = chapters.map((ch) => {
        const existing = (next.novel.chapters ?? []).find((e: any) => e.id === ch.id);
        return { ...existing, ...ch };
      });
      next.meta.version = (next.meta.version ?? 0) + 1;
      next.meta.updated_at = new Date().toISOString();
      saveProject(projectDir, next as any);
    } catch { /* ignore */ }
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
    try {
      renameSync(oldPath, newPath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('project:create-entry', async (_, fullPath: string, isDir: boolean) => {
    assertSafePath(fullPath);
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
