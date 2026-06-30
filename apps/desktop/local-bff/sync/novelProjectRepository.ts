import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadProject, saveProject } from './localProjectRepository';
import { atomicWriteFileSync } from '@orison/shared-contracts/fs/atomicWrite';

// ── 章节元数据 ──

/**
 * 从 project.yaml 的 novel.chapters 中读取单个章节元数据。
 * 找不到返回 null。
 */
export function loadChapterMetadata(projectPath: string, chapterId: string): Record<string, any> | null {
  const project = loadProject(projectPath);
  if (!project) return null;

  const chapters = (project as any).novel?.chapters;
  if (!chapters || !Array.isArray(chapters)) return null;

  const chapter = chapters.find((ch: any) => ch.id === chapterId);
  return chapter ?? null;
}

// ── 章节正文 (Markdown) ──

/**
 * 读取单个章节第一节的 markdown 正文。
 * 文件不存在返回 null。
 */
export function loadChapterMarkdown(projectPath: string, contentFile: string): string | null {
  const filePath = path.join(projectPath, contentFile);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf8');
}

// ── 候选内容接收 ──

export interface ChapterCandidate {
  title?: string;
  content: string;
  summary?: string;
  wordCount?: number;
}

/**
 * 接受章节候选结果：写入 markdown 到第一节并更新 project.yaml 中的章节元数据。
 */
export function acceptChapterCandidate(
  projectPath: string,
  chapterId: string,
  runId: string,
  candidate: ChapterCandidate
): void {
  const project = loadProject(projectPath);
  if (!project) {
    throw new Error(`Project not found at ${projectPath}`);
  }

  const next = structuredClone(project) as any;

  if (!next.novel?.chapters) {
    throw new Error(`Project at ${projectPath} has no novel.chapters`);
  }

  const chapters = next.novel.chapters;
  const chapterIndex = chapters.findIndex((ch: any) => ch.id === chapterId);
  if (chapterIndex === -1) {
    throw new Error(`Chapter ${chapterId} not found in project`);
  }

  const chapter = chapters[chapterIndex];
  const section = chapter.sections?.[0];
  if (!section) {
    throw new Error(`Chapter ${chapterId} has no sections`);
  }

  // 写入 markdown 文件
  const mdDir = path.dirname(path.join(projectPath, section.content_file));
  if (!existsSync(mdDir)) {
    mkdirSync(mdDir, { recursive: true });
  }
  const mdPath = path.join(projectPath, section.content_file);
  atomicWriteFileSync(mdPath, candidate.content, 'utf8');

  // 更新章节元数据
  if (candidate.title !== undefined) {
    chapter.title = candidate.title;
  }
  if (candidate.summary !== undefined) {
    chapter.summary = candidate.summary;
    chapter.summary_source = 'ai';
  }
  if (candidate.wordCount !== undefined) {
    chapter.word_count = candidate.wordCount;
    section.word_count = candidate.wordCount;
  }
  chapter.status = 'draft';
  chapter.last_run_id = runId;
  chapter.generated_at = new Date().toISOString();

  // 持久化 project.yaml
  next.meta.version += 1;
  next.meta.updated_at = new Date().toISOString();

  saveProject(projectPath, next);
}
