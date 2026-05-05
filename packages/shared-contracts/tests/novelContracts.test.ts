import { describe, expect, it } from 'vitest';
import {
  chapterSchema,
  chapterCandidatePatchSchema,
  storyMemoryEntrySchema,
  storyMemoryIndexSchema,
  novelChapterRunRequestSchema,
  novelChapterRunResultSchema,
  novelStorySyncPayloadSchema,
  novelMemoryExtractionPayloadSchema,
  creativeFieldKeys,
  projectFieldPatchSchema,
  fieldPatchEntrySchema,
  taskResultSchema,
} from '../src';

describe('novel migration contracts', () => {
  // ── chapterSchema 扩展 ──

  it('chapterSchema 接受 summary/status/run IDs/content_file', () => {
    const ch = chapterSchema.parse({
      id: 'ch_001',
      title: '第1章 暗夜降临',
      sort_order: 0,
      content_file: 'chapters/ch_001.md',
      summary: '主角来到暗城，发现了一封神秘信件。',
      status: 'draft',
      word_count: 2500,
    });
    expect(ch.id).toBe('ch_001');
    expect(ch.summary).toBe('主角来到暗城，发现了一封神秘信件。');
    expect(ch.status).toBe('draft');
    expect(ch.content_file).toBe('chapters/ch_001.md');
  });

  it('chapterSchema 接受 generation lifecycle 扩展字段', () => {
    const ch = chapterSchema.parse({
      id: 'ch_002',
      title: '第2章',
      sort_order: 1,
      content_file: 'chapters/ch_002.md',
      status: 'generating',
      last_run_id: 'run_abc123',
      generated_at: '2026-05-03T10:00:00Z',
      bridge_notes: '承接上一章结尾，主角推开大门...',
    });
    expect(ch.status).toBe('generating');
    expect(ch.last_run_id).toBe('run_abc123');
    expect(ch.bridge_notes).toBe('承接上一章结尾，主角推开大门...');
  });

  // ── creativeFieldKeys ──

  it('creativeFieldKeys 包含 foreshadow_registry', () => {
    expect(creativeFieldKeys).toContain('foreshadow_registry');
  });

  // ── chapterCandidatePatchSchema ──

  it('chapterCandidatePatchSchema 解析候选内容补丁', () => {
    const patch = chapterCandidatePatchSchema.parse({
      chapterId: 'ch_001',
      runId: 'run_abc123',
      candidate: {
        title: '第1章 暗夜降临',
        content: '夜幕降临时，李探长踏入了暗城...',
        summary: '主角初到暗城。',
        wordCount: 2480,
      },
    });
    expect(patch.chapterId).toBe('ch_001');
    expect(patch.candidate.title).toBe('第1章 暗夜降临');
    expect(patch.candidate.content).toContain('李探长');
  });

  it('chapterCandidatePatchSchema 接受仅含 content 的最小候选', () => {
    const patch = chapterCandidatePatchSchema.parse({
      chapterId: 'ch_001',
      runId: 'run_min',
      candidate: {
        content: '最小内容。',
      },
    });
    expect(patch.candidate.title).toBeUndefined();
    expect(patch.candidate.content).toBe('最小内容。');
  });

  // ── storyMemoryEntrySchema ──

  it('storyMemoryEntrySchema 解析持久化记忆条目', () => {
    const entry = storyMemoryEntrySchema.parse({
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
      sourceExcerpt: '他脱下外套，露出满身伤疤...',
      createdAt: '2026-05-03T10:00:00Z',
      embeddingModel: 'placeholder-embedding-model',
      embedding: [0.1, 0.2, 0.3],
      embeddingDim: 3,
    });
    expect(entry.memoryType).toBe('character');
    expect(entry.importanceScore).toBe(0.8);
    expect(entry.relatedCharacters).toContain('char_main');
    expect(entry.embeddingModel).toBe('placeholder-embedding-model');
    expect(entry.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(entry.embeddingDim).toBe(3);
  });

  it('storyMemoryEntrySchema 使用默认值', () => {
    const entry = storyMemoryEntrySchema.parse({
      id: 'mem_002',
      novelId: '00001',
      chapterId: 'ch_001',
      chapterNumber: 1,
      memoryType: 'event',
      title: '初到暗城',
      content: '主角第一次到达暗城。',
      importanceScore: 0.5,
    });
    expect(entry.isForeshadow).toBe(false);
    expect(entry.relatedCharacters).toEqual([]);
    expect(entry.tags).toEqual([]);
  });

  // ── storyMemoryIndexSchema ──

  it('storyMemoryIndexSchema 解析记忆索引', () => {
    const index = storyMemoryIndexSchema.parse({
      novelId: '00001',
      entries: [
        {
          id: 'mem_001',
          novelId: '00001',
          chapterId: 'ch_003',
          chapterNumber: 3,
          memoryType: 'character',
          title: '李探长的背景',
          content: '李探长曾在军队服役。',
          importanceScore: 0.8,
        },
      ],
      version: 1,
      updatedAt: '2026-05-03T10:00:00Z',
    });
    expect(index.entries).toHaveLength(1);
    expect(index.version).toBe(1);
  });

  it('storyMemoryIndexSchema 空索引默认值', () => {
    const index = storyMemoryIndexSchema.parse({
      novelId: '00001',
    });
    expect(index.entries).toEqual([]);
    expect(index.version).toBe(0);
  });

  // ── novelChapterRunRequestSchema ──

  it('novelChapterRunRequestSchema 解析章节生成请求', () => {
    const req = novelChapterRunRequestSchema.parse({
      projectPath: 'I:/workspace/novel_001',
      chapterId: 'ch_005',
      mode: 'generate',
      instruction: '本章需要引入反派角色。',
    });
    expect(req.projectPath).toBe('I:/workspace/novel_001');
    expect(req.chapterId).toBe('ch_005');
    expect(req.mode).toBe('generate');
  });

  it('novelChapterRunRequestSchema 接受 continue/polish/review 模式', () => {
    for (const mode of ['generate', 'continue', 'polish', 'review']) {
      const req = novelChapterRunRequestSchema.parse({
        projectPath: '/tmp/test',
        chapterId: 'ch_001',
        mode,
      });
      expect(req.mode).toBe(mode);
    }
  });

  // ── novelChapterRunResultSchema ──

  it('novelChapterRunResultSchema 解析章节运行结果', () => {
    const result = novelChapterRunResultSchema.parse({
      runId: 'run_abc123',
      chapterId: 'ch_005',
      candidate: {
        title: '第5章 反派出场',
        content: '正当李探长调查时，一个黑影出现在门口...',
        summary: '反派出场，与主角首次对峙。',
        wordCount: 2520,
      },
      artifacts: {
        reviewNotes: '反派动机需要更明确。',
        bridgeOutput: '承接上一章结尾的线索。',
      },
    });
    expect(result.candidate.title).toBe('第5章 反派出场');
    expect(result.artifacts?.reviewNotes).toContain('反派动机');
  });

  // ── novelStorySyncPayloadSchema ──

  it('novelStorySyncPayloadSchema 解析故事同步输出', () => {
    const sync = novelStorySyncPayloadSchema.parse({
      runId: 'run_abc123',
      chapterId: 'ch_005',
      patches: [
        {
          field: 'asset_cards',
          action: 'merge',
          data: { id: 'char_villain', type: 'character', name: '暗影' },
          fieldVersion: 2,
          generatedBy: 'story-sync-agent',
        },
      ],
      summary: '新增反派角色"暗影"的资产卡。',
    });
    expect(sync.patches).toHaveLength(1);
    expect(sync.patches[0].field).toBe('asset_cards');
  });

  // ── novelMemoryExtractionPayloadSchema ──

  it('novelMemoryExtractionPayloadSchema 解析记忆提取输出', () => {
    const mem = novelMemoryExtractionPayloadSchema.parse({
      runId: 'run_abc123',
      chapterId: 'ch_005',
      entries: [
        {
          id: 'mem_new_001',
          novelId: '00001',
          chapterId: 'ch_005',
          chapterNumber: 5,
          memoryType: 'event',
          title: '反派首次登场',
          content: '反派"暗影"首次出现在主角面前。',
          importanceScore: 0.9,
          isForeshadow: true,
          tags: ['反派', '关键事件'],
        },
      ],
    });
    expect(mem.entries).toHaveLength(1);
    expect(mem.entries[0].isForeshadow).toBe(true);
  });

  // ── projectFieldPatchSchema 扩展 ──

  it('projectFieldPatchSchema 支持 chapter_candidate 类型的补丁', () => {
    const patch = projectFieldPatchSchema.parse({
      runId: 'run_abc123',
      createdAt: '2026-05-03T10:00:00Z',
      patches: [
        {
          field: 'foreshadow_registry',
          action: 'merge',
          data: {
            items: [
              {
                id: 'fs_new',
                title: 'new thread',
                content: 'A new thread.',
              },
            ],
          },
          fieldVersion: 1,
          generatedBy: 'story-sync-agent',
        },
      ],
    });
    expect(patch.patches[0].field).toBe('foreshadow_registry');
  });

  // ── taskResultSchema 扩展 ──

  it('taskResultSchema 支持 chapter_candidate 输出类型', () => {
    const result = taskResultSchema.parse({
      taskId: 'task_001',
      status: 'completed',
      outputType: 'chapter_candidate',
      outputPayload: {
        operations: [
          { op: 'replace', path: '/chapters/ch_005', value: { title: '新标题' } },
        ],
      },
      summary: '章节生成完成',
      rationale: '按照大纲要求生成第5章',
      reviewHint: '请确认反派角色的出场方式',
      retryable: true,
    });
    expect(result.outputType).toBe('chapter_candidate');
  });
});