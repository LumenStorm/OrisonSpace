import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { loadMemoryIndex, saveMemoryIndex, addMemoryEntry } from '../sync/memoryRepository';

const TEST_PROJECT_DIR = path.join(process.cwd(), 'test-tmp-memory');

describe('memory repository', () => {
  afterEach(() => {
    if (existsSync(TEST_PROJECT_DIR)) {
      rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  it('loadMemoryIndex 对不存在的索引返回空默认值', () => {
    const index = loadMemoryIndex(TEST_PROJECT_DIR, '00001');

    expect(index).not.toBeNull();
    expect(index.novelId).toBe('00001');
    expect(index.entries).toEqual([]);
    expect(index.version).toBe(0);
  });

  it('saveMemoryIndex / loadMemoryIndex 往返一致', () => {
    const index = {
      novelId: '00001',
      entries: [
        {
          id: 'mem_001',
          novelId: '00001',
          chapterId: 'ch_003',
          chapterNumber: 3,
          memoryType: 'character',
          title: '李探长的背景',
          content: '李探长曾在军队服役，擅长近身格斗。',
          importanceScore: 0.8,
          relatedCharacters: ['char_main'],
          tags: ['背景故事', '能力'],
          isForeshadow: false,
        },
      ],
      version: 1,
      updatedAt: '2026-05-03T10:00:00Z',
    };

    saveMemoryIndex(TEST_PROJECT_DIR, index);

    const loaded = loadMemoryIndex(TEST_PROJECT_DIR, '00001');
    expect(loaded.entries).toHaveLength(1);
    expect(loaded.entries[0].id).toBe('mem_001');
    expect(loaded.entries[0].memoryType).toBe('character');
    expect(loaded.entries[0].importanceScore).toBe(0.8);
    expect(loaded.version).toBe(1);
  });

  it('saveMemoryIndex 写入 YAML 文件到 memory/ 子目录', () => {
    saveMemoryIndex(TEST_PROJECT_DIR, {
      novelId: '00001',
      entries: [],
      version: 0,
    });

    const expectedPath = path.join(TEST_PROJECT_DIR, 'memory', 'story-memory.yaml');
    expect(existsSync(expectedPath)).toBe(true);

    const raw = readFileSync(expectedPath, 'utf8');
    expect(raw).toContain('00001');
  });

  it('addMemoryEntry 追加条目并递增版本', () => {
    // 先保存空索引
    saveMemoryIndex(TEST_PROJECT_DIR, {
      novelId: '00001',
      entries: [],
      version: 0,
    });

    // 添加记忆条目
    const entry = {
      id: 'mem_new_01',
      novelId: '00001',
      chapterId: 'ch_005',
      chapterNumber: 5,
      memoryType: 'event',
      title: '反派首次登场',
      content: '反派"暗影"首次出现在主角面前。',
      importanceScore: 0.9,
      relatedCharacters: ['char_villain'],
      isForeshadow: true,
      tags: ['反派', '关键事件'],
    };

    const updated = addMemoryEntry(TEST_PROJECT_DIR, entry);

    expect(updated.entries).toHaveLength(1);
    expect(updated.entries[0].id).toBe('mem_new_01');
    expect(updated.entries[0].isForeshadow).toBe(true);
    expect(updated.version).toBe(1);

    // 确认持久化
    const loaded = loadMemoryIndex(TEST_PROJECT_DIR, '00001');
    expect(loaded.entries).toHaveLength(1);
    expect(loaded.entries[0].title).toBe('反派首次登场');
  });

  it('addMemoryEntry 重复 ID 的条目覆盖旧条目', () => {
    saveMemoryIndex(TEST_PROJECT_DIR, {
      novelId: '00001',
      entries: [
        {
          id: 'mem_dup',
          novelId: '00001',
          chapterId: 'ch_001',
          chapterNumber: 1,
          memoryType: 'event',
          title: '旧标题',
          content: '旧内容。',
          importanceScore: 0.3,
          relatedCharacters: [],
          tags: [],
          isForeshadow: false,
        },
      ],
      version: 1,
    });

    const updatedEntry = {
      id: 'mem_dup',
      novelId: '00001',
      chapterId: 'ch_001',
      chapterNumber: 1,
      memoryType: 'event',
      title: '新标题',
      content: '更新后的内容。',
      importanceScore: 0.8,
      relatedCharacters: [],
      tags: [],
      isForeshadow: false,
    };

    const updated = addMemoryEntry(TEST_PROJECT_DIR, updatedEntry);
    expect(updated.entries).toHaveLength(1);
    expect(updated.entries[0].title).toBe('新标题');
    expect(updated.entries[0].importanceScore).toBe(0.8);
  });
});
