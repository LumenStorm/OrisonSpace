import type { FileTreeEntry } from '@orison/shared-contracts';
import type { ChapterStatus, NovelChapterMeta, SectionMeta } from './novelChapterSlice';
import { normalizePath } from '../utils/paths';

type DiskChapter = {
  id: string;
  fileName: string;
  title: string;
  contentFile: string;
  explicitOrder: number | null;
  wordCount?: number;
};

const MARKDOWN_EXT = /\.md$/i;
const FRONTMATTER_RE = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const HEADING_RE = /^#\s+(.+?)\s*#*\s*$/m;
const ORDER_RE = /^order:\s*([0-9]+)\s*$/m;

export function chaptersFromProjectDocument(doc: unknown): NovelChapterMeta[] {
  const chapters = (doc as any)?.novel?.chapters;
  if (!Array.isArray(chapters)) return [];
  return chapters.map((ch: any) => ({
    id: ch.id,
    title: ch.title,
    sortOrder: ch.sort_order,
    status: ch.status ?? 'draft',
    summary: ch.summary,
    summarySource: ch.summary_source,
    sections: (ch.sections ?? []).map((s: any) => ({
      id: s.id,
      title: s.title,
      sortOrder: s.sort_order,
      contentFile: s.content_file,
      wordCount: s.word_count,
    })),
  }));
}

export async function deriveChaptersFromDisk(
  projectPath: string,
  existingChapters: NovelChapterMeta[] = [],
): Promise<NovelChapterMeta[]> {
  const api = window.orisonDesktop;
  if (!projectPath || !api?.readDirectory) return existingChapters;

  let entries: FileTreeEntry[];
  try {
    entries = await api.readDirectory(projectPath, 2);
  } catch {
    return existingChapters;
  }

  const files = collectChapterFiles(entries);
  if (files.length === 0) return [];

  const base = normalizePath(projectPath).replace(/\/+$/, '');
  const diskChapters = await Promise.all(files.map(async (file) => {
    let content: string | null = null;
    try {
      content = await api.readFile?.(`${base}/${file.contentFile}`) ?? null;
    } catch {
      content = null;
    }
    return chapterFromDiskFile(file.fileName, file.contentFile, content);
  }));

  return mergeDiskAndStoredChapters(sortDiskChapters(diskChapters), existingChapters);
}

function collectChapterFiles(entries: FileTreeEntry[]): Array<{ fileName: string; contentFile: string }> {
  const chaptersDir = entries.find((entry) =>
    entry.isDir && normalizeRelativePath(entry.path) === 'chapters'
  );
  const children = chaptersDir?.children ?? [];
  return children
    .filter((entry) => !entry.isDir && MARKDOWN_EXT.test(entry.name))
    .map((entry) => {
      const rel = normalizeRelativePath(entry.path);
      return {
        fileName: entry.name,
        contentFile: rel.startsWith('chapters/') ? rel : `chapters/${entry.name}`,
      };
    });
}

function chapterFromDiskFile(fileName: string, contentFile: string, content: string | null): DiskChapter {
  const id = fileName.replace(MARKDOWN_EXT, '');
  const text = content ?? '';
  const body = stripFrontmatter(text);
  const heading = body.match(HEADING_RE)?.[1]?.trim();
  const explicitOrder = parseFrontmatterOrder(text);
  return {
    id,
    fileName,
    title: heading || id,
    contentFile,
    explicitOrder,
    wordCount: content === null ? undefined : text.replace(/\s/g, '').length,
  };
}

function sortDiskChapters(chapters: DiskChapter[]): DiskChapter[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const hasExplicitOrder = chapters.some((chapter) => chapter.explicitOrder !== null);
  return [...chapters].sort((a, b) => {
    if (hasExplicitOrder) {
      const orderA = a.explicitOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.explicitOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
    }
    return collator.compare(a.fileName, b.fileName);
  });
}

function mergeDiskAndStoredChapters(
  diskChapters: DiskChapter[],
  existingChapters: NovelChapterMeta[],
): NovelChapterMeta[] {
  const existingById = new Map(existingChapters.map((chapter) => [chapter.id, chapter]));
  return diskChapters.map((disk, index) => {
    const existing = existingById.get(disk.id);
    const section = mergeSection(disk, existing?.sections?.[0]);
    return {
      id: disk.id,
      title: existing?.title || disk.title,
      sortOrder: index,
      status: normalizeStatus(existing?.status),
      summary: existing?.summary,
      summarySource: existing?.summarySource,
      sections: [section],
    };
  });
}

function mergeSection(disk: DiskChapter, existing?: SectionMeta): SectionMeta {
  return {
    id: existing?.id || `${disk.id}_main`,
    title: existing?.title,
    sortOrder: existing?.sortOrder ?? 0,
    contentFile: disk.contentFile,
    wordCount: disk.wordCount ?? existing?.wordCount,
  };
}

function normalizeStatus(status: ChapterStatus | undefined): ChapterStatus {
  return status ?? 'draft';
}

function stripFrontmatter(text: string): string {
  return text.replace(FRONTMATTER_RE, '');
}

function parseFrontmatterOrder(text: string): number | null {
  const frontmatter = text.match(FRONTMATTER_RE)?.[1];
  if (!frontmatter) return null;
  const raw = frontmatter.match(ORDER_RE)?.[1];
  if (!raw) return null;
  const order = Number.parseInt(raw, 10);
  return Number.isFinite(order) ? order : null;
}

function normalizeRelativePath(path: string): string {
  return normalizePath(path).replace(/^\/+/, '');
}
