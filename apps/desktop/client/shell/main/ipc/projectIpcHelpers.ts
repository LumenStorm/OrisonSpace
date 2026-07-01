import { readdirSync } from 'node:fs';
import path from 'node:path';
import type { SaveBase64ImageInput } from '@orison/shared-contracts';
import { assertWithinProject } from './pathGuard';

export type FileEntry = {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileEntry[];
};

/** Max entries per directory level to prevent memory blow-up on huge repos. */
const MAX_ENTRIES_PER_DIR = 500;

export const ALLOWED_IMAGE_DIRS = new Set(['temp/images/generation', 'assets/images']);

const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function readDirectoryRecursive(
  dirPath: string,
  basePath: string,
  maxDepth: number,
  depth = 0,
): FileEntry[] {
  if (depth >= maxDepth) return [];
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const result: FileEntry[] = [];
    // Sort: directories first, then alphabetical
    const sorted = entries.slice().sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    let count = 0;
    for (const entry of sorted) {
      if (count >= MAX_ENTRIES_PER_DIR) break;
      // Skip hidden files and common noise
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = '/' + path.relative(basePath, fullPath).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        result.push({
          name: entry.name,
          path: relativePath,
          isDir: true,
          children: readDirectoryRecursive(fullPath, basePath, maxDepth, depth + 1),
        });
      } else {
        result.push({ name: entry.name, path: relativePath, isDir: false });
      }
      count++;
    }
    return result;
  } catch {
    return [];
  }
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').some((part) => part === '..')) {
    throw new Error('Invalid relative path');
  }
  return normalized;
}

export function buildProjectPath(projectDir: string, relativePath: string): string {
  const fullPath = path.join(projectDir, normalizeRelativePath(relativePath));
  assertWithinProject(projectDir, fullPath);
  return fullPath;
}

function sanitizeFileName(value: string): string {
  // eslint-disable-next-line no-control-regex
  const sanitized = value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/\s+/g, '-').slice(0, 80);
  return sanitized || 'image';
}

export function createImageFileName(input: SaveBase64ImageInput): string {
  const ext = MIME_EXT[input.mimeType] ?? '.png';
  const rawName = input.fileName ? sanitizeFileName(input.fileName) : `image-${Date.now()}`;
  return rawName.toLowerCase().endsWith(ext) ? rawName : `${rawName}${ext}`;
}

const EXT_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const BINARY_READABLE_EXTS = new Set(Object.keys(EXT_MIME));

/** Returns true when the file extension belongs to the binary-readable allowlist. */
export function isBinaryReadable(ext: string): boolean {
  return BINARY_READABLE_EXTS.has(ext.toLowerCase());
}

/** Maps a file extension (with leading dot) to a MIME type, or null if unknown. */
export function mimeTypeFromExt(ext: string): string | null {
  return EXT_MIME[ext.toLowerCase()] ?? null;
}
