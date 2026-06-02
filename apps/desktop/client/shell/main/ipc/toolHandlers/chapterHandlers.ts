/**
 * Chapter tool handlers — chapter_list, chapter_read, chapter_write
 */
import { existsSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { assertWithinProject } from '../pathGuard';
import { notifyUI } from '../toolNotify';
import type { ToolHandler } from '../toolExecution';
import { atomicWriteFileSync } from '../../fs/atomicWrite';

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

  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf-8');
    if (existing === content) {
      const wordCount = content.replace(/\s+/g, '').length;
      return {
        title: `chapter_write: ${chapterId}`,
        output: `Chapter ${chapterId} already up to date (${wordCount} chars). No changes needed — proceed to the next chapter.`,
        metadata: { wordCount },
      };
    }
  }

  atomicWriteFileSync(filePath, content, 'utf-8');
  notifyUI({ type: 'chapter:changed', chapterId });
  const wordCount = content.replace(/\s+/g, '').length;
  return {
    title: `chapter_write: ${chapterId}`,
    output: `Wrote chapter ${chapterId} (${wordCount} chars). Chapter saved — proceed to the next chapter.`,
    metadata: { wordCount },
  };
};
