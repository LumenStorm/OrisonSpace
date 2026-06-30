/**
 * Chapter tool handlers — chapter_list, chapter_read, chapter_write
 */
import { existsSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { assertWithinProject } from '../pathGuard';
import { notifyUI } from '../toolNotify';
import type { ToolHandler } from '../toolExecution';
import { atomicWriteFileSync } from '@orison/shared-contracts/fs/atomicWrite';

const CHAPTERS_DIR = 'chapters';

export const chapterListHandler: ToolHandler = async ({ projectDir }) => {
  const dir = path.join(projectDir, CHAPTERS_DIR);
  if (!existsSync(dir)) return { title: 'chapter_list', output: 'No chapters directory found.', metadata: { count: 0 } };

  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  const summaries = files.map((f) => {
    const content = readFileSync(path.join(dir, f), 'utf-8');
    const firstLine = content.split('\n')[0] || f;
    return `${f}: ${firstLine.replace(/^#+\s*/, '')}`;
  });

  return {
    title: 'chapter_list',
    output: summaries.join('\n'),
    metadata: { count: files.length },
  };
};

export const chapterReadHandler: ToolHandler = async ({ params, projectDir }) => {
  const { chapterId } = params as { chapterId: string };
  const filePath = path.join(projectDir, CHAPTERS_DIR, `${chapterId}.md`);
  assertWithinProject(projectDir, filePath);
  if (!existsSync(filePath)) throw new Error(`Chapter not found: ${chapterId}`);

  const content = readFileSync(filePath, 'utf-8');
  return {
    title: `chapter: ${chapterId}`,
    output: content,
  };
};

export const chapterWriteHandler: ToolHandler = async ({ params, projectDir }) => {
  const { chapterId, content } = params as { chapterId: string; content: string };
  const dir = path.join(projectDir, CHAPTERS_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${chapterId}.md`);
  assertWithinProject(projectDir, filePath);

  // Snapshot the pre-write content so suggest-mode "reject" can restore it
  // (the tool writes to disk now; the diff is reviewed afterwards). null marks
  // a brand-new file, which reject should delete rather than blank out.
  const existedBefore = existsSync(filePath);
  const previousContent = existedBefore ? readFileSync(filePath, 'utf-8') : null;

  if (existedBefore) {
    const existing = previousContent as string;
    if (existing === content) {
      const wordCount = content.replace(/\s+/g, '').length;
      return {
        title: `chapter_write: ${chapterId}`,
        output: `Chapter ${chapterId} already up to date (${wordCount} chars). No changes needed — proceed to the next chapter.`,
        metadata: { wordCount, previousContent, existedBefore },
      };
    }
  }

  atomicWriteFileSync(filePath, content, 'utf-8');
  // Notify both chapter-level listeners (word count) and file-level listeners
  // (open-tab reload). Without file:changed, an editor showing this chapter
  // won't refresh until manually closed and reopened (issue #4). Path is
  // project-relative, matching writeFileHandler's convention.
  notifyUI({ type: 'chapter:changed', chapterId });
  notifyUI({ type: 'file:changed', path: `${CHAPTERS_DIR}/${chapterId}.md` });
  const wordCount = content.replace(/\s+/g, '').length;
  return {
    title: `chapter_write: ${chapterId}`,
    output: `Wrote chapter ${chapterId} (${wordCount} chars). Chapter saved — proceed to the next chapter.`,
    metadata: { wordCount, previousContent, existedBefore },
  };
};

export const rewritePassageHandler: ToolHandler = async ({ params }) => {
  const { chapterId, filePath, originalText, replacement } = params as {
    chapterId?: string; filePath?: string; originalText: string; replacement: string;
  };
  return {
    title: 'rewrite_passage',
    output: `Passage rewrite prepared (${replacement.length} chars). Awaiting user review.`,
    metadata: {
      type: 'passage',
      chapterId,
      filePath,
      originalText,
      replacement,
    },
  };
};
