import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createEmptyProjectDocument, saveProject } from '../sync/localProjectRepository';
import {
  loadChapterMetadata,
  loadChapterMarkdown,
  acceptChapterCandidate,
} from '../sync/novelProjectRepository';

const TEST_PROJECT_DIR = path.join(process.cwd(), 'test-tmp-novel-project');

describe('novel project repository', () => {
  afterEach(() => {
    if (existsSync(TEST_PROJECT_DIR)) {
      rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  it('loadChapterMetadata 读取章节元数据（从 project.yaml 的 novel.chapters）', () => {
    const project = createEmptyProjectDocument('Chapter Meta Test');
    const withNovel = {
      ...project,
      novel: {
        chapters: [
          {
            id: 'ch_001',
            title: '第1章 暗夜降临',
            sort_order: 0,
            content_file: 'chapters/ch_001.md',
            summary: '主角来到暗城。',
            status: 'draft',
            word_count: 2500,
          },
          {
            id: 'ch_002',
            title: '第2章 迷局',
            sort_order: 1,
            content_file: 'chapters/ch_002.md',
            status: 'generating',
            last_run_id: 'run_abc123',
            bridge_notes: '承接第一章结尾...',
          },
        ],
      },
    };
    saveProject(TEST_PROJECT_DIR, withNovel as any);

    const chapter = loadChapterMetadata(TEST_PROJECT_DIR, 'ch_001');

    expect(chapter).not.toBeNull();
    expect(chapter!.id).toBe('ch_001');
    expect(chapter!.title).toBe('第1章 暗夜降临');
    expect(chapter!.content_file).toBe('chapters/ch_001.md');
    expect(chapter!.status).toBe('draft');
  });

  it('loadChapterMetadata 对不存在的章节ID返回 null', () => {
    const project = createEmptyProjectDocument('Not Found Test');
    saveProject(TEST_PROJECT_DIR, project);

    const chapter = loadChapterMetadata(TEST_PROJECT_DIR, 'ch_nonexistent');
    expect(chapter).toBeNull();
  });

  it('loadChapterMarkdown 读取章节 markdown 内容', () => {
    // 创建 project.yaml + 对应的 md 文件
    const project = createEmptyProjectDocument('Markdown Test');
    const withNovel = {
      ...project,
      novel: {
        chapters: [
          { id: 'ch_001', title: '第1章', sort_order: 0, content_file: 'chapters/ch_001.md' },
        ],
      },
    };
    saveProject(TEST_PROJECT_DIR, withNovel as any);

    // 写入 markdown 文件
    const mdDir = path.join(TEST_PROJECT_DIR, 'chapters');
    mkdirSync(mdDir, { recursive: true });
    writeFileSync(path.join(mdDir, 'ch_001.md'), '# 第1章\n\n夜幕降临，主角踏入暗城。', 'utf8');

    const content = loadChapterMarkdown(TEST_PROJECT_DIR, 'chapters/ch_001.md');

    expect(typeof content).toBe('string');
    expect(content!.length).toBeGreaterThan(0);
    expect(content).toContain('第1章');
  });

  it('loadChapterMarkdown 对不存在的文件返回 null', () => {
    const content = loadChapterMarkdown(TEST_PROJECT_DIR, 'chapters/不存在.md');
    expect(content).toBeNull();
  });

  it('acceptChapterCandidate 写入 markdown 并更新 chapter 元数据', () => {
    const project = createEmptyProjectDocument('Accept Test');
    const withNovel = {
      ...project,
      novel: {
        chapters: [
          {
            id: 'ch_001',
            title: '旧标题',
            sort_order: 0,
            content_file: 'chapters/ch_001.md',
            status: 'generating',
            last_run_id: 'run_test456',
          },
        ],
      },
    };
    saveProject(TEST_PROJECT_DIR, withNovel as any);

    const candidate = {
      title: '第1章 新标题',
      content: '夜幕降临，主角踏入暗城。\n\n这是一座永不眠的城市。',
      summary: '主角初到暗城的新版摘要。',
      wordCount: 42,
    };

    acceptChapterCandidate(TEST_PROJECT_DIR, 'ch_001', 'run_accept1', candidate);

    // 验证 markdown 已写入
    const mdPath = path.join(TEST_PROJECT_DIR, 'chapters/ch_001.md');
    expect(existsSync(mdPath)).toBe(true);
    const mdContent = readFileSync(mdPath, 'utf8');
    expect(mdContent).toContain('夜幕降临');

    // 验证 project.yaml 中元数据已更新
    const updated = loadChapterMetadata(TEST_PROJECT_DIR, 'ch_001');
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('第1章 新标题');
    expect(updated!.summary).toBe('主角初到暗城的新版摘要。');
    expect(updated!.word_count).toBe(42);
    expect(updated!.status).toBe('draft');
  });

  it('acceptChapterCandidate 仅含最小内容时正确写入', () => {
    const project = createEmptyProjectDocument('Min Candidate');
    const withNovel = {
      ...project,
      novel: {
        chapters: [
          { id: 'ch_001', title: '最小章', sort_order: 0, content_file: 'chapters/ch_001.md', status: 'generating' },
        ],
      },
    };
    saveProject(TEST_PROJECT_DIR, withNovel as any);

    acceptChapterCandidate(TEST_PROJECT_DIR, 'ch_001', 'run_min', { content: '最小内容。' });

    const mdPath = path.join(TEST_PROJECT_DIR, 'chapters/ch_001.md');
    expect(existsSync(mdPath)).toBe(true);
    expect(readFileSync(mdPath, 'utf8')).toBe('最小内容。');
  });
});
