import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { saveMemoryIndex } from '../sync/memoryRepository';
import { saveTagRegistry } from '../sync/tagRegistry';
import { executeRecallStep } from '../sync/novelRecallStep';
import type { StoryMemoryEntry, TagRegistry } from '@orison/shared-contracts';

const TEST_DIR = path.join(process.cwd(), '.test-recall-step-tmp');
const NOVEL_ID = 'novel_001';

function makeEntry(overrides: Partial<StoryMemoryEntry> & { id: string }): StoryMemoryEntry {
  return {
    novelId: NOVEL_ID,
    chapterId: 'ch_001',
    chapterNumber: 1,
    memoryType: 'event',
    title: '测试',
    content: '内容',
    importanceScore: 0.5,
    relatedCharacters: [],
    tags: [],
    isForeshadow: false,
    structuredTags: [],
    importance: 'medium',
    recallBudget: 50,
    ...overrides,
  };
}

describe('novelRecallStep', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(path.join(TEST_DIR, 'memory'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it('executeRecallStep 归一化标签后召回相关记忆', () => {
    // 注册标签（含 alias）
    const registry: TagRegistry = {
      novelId: NOVEL_ID,
      entries: [
        { id: 'character:张三', category: 'character', canonicalName: '张三', aliases: ['小张', '张道友'], lastSeenChapter: 3 },
      ],
      version: 0,
    };
    saveTagRegistry(TEST_DIR, registry);

    // 保存记忆
    saveMemoryIndex(TEST_DIR, {
      novelId: NOVEL_ID,
      entries: [
        makeEntry({
          id: 'mem_1',
          title: '张三突破',
          content: '张三在第3章突破筑基期',
          chapterNumber: 3,
          structuredTags: [{ category: 'character', value: '张三', role: 'subject' }],
          importance: 'high',
        }),
      ],
      version: 1,
    });

    // 使用 alias "小张" 查询，应归一化为 "张三" 并命中
    const result = executeRecallStep({
      projectPath: TEST_DIR,
      novelId: NOVEL_ID,
      currentChapter: 5,
      recallTags: [{ category: 'character', value: '小张' }],
    });

    expect(result.entryCount).toBe(1);
    expect(result.recalledMemoriesText).toContain('张三突破');
    expect(result.truncated).toBe(false);
  });

  it('无匹配时返回空结果', () => {
    saveMemoryIndex(TEST_DIR, { novelId: NOVEL_ID, entries: [], version: 0 });

    const result = executeRecallStep({
      projectPath: TEST_DIR,
      novelId: NOVEL_ID,
      currentChapter: 1,
      recallTags: [{ category: 'character', value: '不存在' }],
    });

    expect(result.entryCount).toBe(0);
    expect(result.recalledMemoriesText).toBe('');
  });
});
