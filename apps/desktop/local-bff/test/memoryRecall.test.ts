import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { saveMemoryIndex } from '../sync/memoryRepository';
import { recallMemories, formatRecalledMemories } from '../sync/memoryRecall';
import type { StoryMemoryEntry } from '@orison/shared-contracts';

const TEST_DIR = path.join(process.cwd(), '.test-recall-tmp');
const NOVEL_ID = 'novel_001';

function makeEntry(overrides: Partial<StoryMemoryEntry> & { id: string }): StoryMemoryEntry {
  return {
    novelId: NOVEL_ID,
    chapterId: 'ch_001',
    chapterNumber: 1,
    memoryType: 'event',
    title: '测试记忆',
    content: '测试内容',
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

describe('memoryRecall', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(path.join(TEST_DIR, 'memory'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it('按标签匹配召回相关记忆', () => {
    saveMemoryIndex(TEST_DIR, {
      novelId: NOVEL_ID,
      entries: [
        makeEntry({
          id: 'mem_1',
          title: '张三突破筑基',
          content: '张三在山洞中突破筑基期',
          structuredTags: [
            { category: 'character', value: '张三', role: 'subject' },
            { category: 'event', value: '突破', role: 'context' },
          ],
          importance: 'high',
        }),
        makeEntry({
          id: 'mem_2',
          title: '李四出场',
          content: '李四首次登场',
          structuredTags: [
            { category: 'character', value: '李四', role: 'subject' },
          ],
          importance: 'medium',
        }),
        makeEntry({
          id: 'mem_3',
          title: '无标签记忆',
          content: '没有结构化标签',
          structuredTags: [],
        }),
      ],
      version: 1,
    });

    const result = recallMemories(TEST_DIR, NOVEL_ID, {
      tags: [{ category: 'character', value: '张三' }],
      maxTokenBudget: 2000,
      currentChapter: 5,
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('mem_1');
    expect(result.truncated).toBe(false);
  });

  it('critical 条目始终包含，不计入预算上限', () => {
    saveMemoryIndex(TEST_DIR, {
      novelId: NOVEL_ID,
      entries: [
        makeEntry({
          id: 'mem_critical',
          title: '核心伏笔',
          content: '这是一个非常重要的伏笔'.repeat(10),
          structuredTags: [
            { category: 'foreshadow', value: '古剑认主', role: 'subject' },
          ],
          importance: 'critical',
          recallBudget: 500,
        }),
        makeEntry({
          id: 'mem_normal',
          title: '普通记忆',
          content: '普通内容',
          structuredTags: [
            { category: 'foreshadow', value: '古剑认主', role: 'context' },
          ],
          importance: 'medium',
          recallBudget: 50,
        }),
      ],
      version: 1,
    });

    const result = recallMemories(TEST_DIR, NOVEL_ID, {
      tags: [{ category: 'foreshadow', value: '古剑认主' }],
      maxTokenBudget: 100,
      currentChapter: 10,
    });

    expect(result.entries.some(e => e.id === 'mem_critical')).toBe(true);
    expect(result.entries.some(e => e.id === 'mem_normal')).toBe(true);
  });

  it('超出预算时截断低优先级条目', () => {
    const entries = Array.from({ length: 20 }, (_, i) => makeEntry({
      id: `mem_${i}`,
      title: `记忆${i}`,
      content: '内容'.repeat(50),
      structuredTags: [{ category: 'character', value: '张三', role: 'subject' }],
      importance: 'medium',
      recallBudget: 200,
    }));

    saveMemoryIndex(TEST_DIR, { novelId: NOVEL_ID, entries, version: 1 });

    const result = recallMemories(TEST_DIR, NOVEL_ID, {
      tags: [{ category: 'character', value: '张三' }],
      maxTokenBudget: 500,
      currentChapter: 25,
    });

    expect(result.entries.length).toBeLessThan(20);
    expect(result.truncated).toBe(true);
    expect(result.totalTokens).toBeLessThanOrEqual(500);
  });

  it('formatRecalledMemories 格式化输出', () => {
    const entries: StoryMemoryEntry[] = [
      makeEntry({ id: 'mem_1', title: '事件A', content: '内容A', chapterNumber: 3 }),
      makeEntry({ id: 'mem_2', title: '事件B', content: '内容B', chapterNumber: 7 }),
    ];

    const text = formatRecalledMemories(entries);
    expect(text).toContain('【事件A】(第3章)');
    expect(text).toContain('【事件B】(第7章)');
  });

  it('空查询返回空结果', () => {
    saveMemoryIndex(TEST_DIR, { novelId: NOVEL_ID, entries: [], version: 0 });

    const result = recallMemories(TEST_DIR, NOVEL_ID, {
      tags: [{ category: 'character', value: '不存在' }],
    });

    expect(result.entries).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
    expect(result.truncated).toBe(false);
  });
});
