import { describe, expect, it } from 'vitest';
import { createStorySyncNode, createMemoryExtractorNode } from '../src/nodes/base';

/**
 * Phase 4: Story Sync 与 Memory Extractor 的纯单元测试。
 *
 * 这两个节点都是 TypeScript 节点（不依赖 Python AI）：
 * - story-sync-agent: 从章节内容/上下文中提取出对 world/asset/foreshadow 的更新建议，
 *   输出 ProjectFieldPatch 兼容的 patches 数组。
 * - memory-extractor-agent: 从章节正文 + 候选元数据中提取 StoryMemoryEntry 数组，
 *   方便后续 LongTermMemory 检索。
 */

describe('story-sync-agent', () => {
  it('从章节正文与候选信息生成 field patches', async () => {
    const node = createStorySyncNode();
    const result = await node.run({
      run: {
        runId: 'run_novel_test',
        status: 'running',
        currentNodeId: 'story-sync-agent',
        projectPath: '/tmp/x',
        completedNodes: [],
        pendingNodes: [],
        artifacts: {
          'context.chapterContext': {
            chapterId: 'ch_001',
            chapterNumber: 1,
            novelTitle: '测试小说',
            assetCards: [],
            foreshadowRegistry: { items: [], version: 0, updatedBy: 'agent' },
          },
          'chapter.candidate': {
            chapterId: 'ch_001',
            title: '第1章 暗夜',
            content: '李探长走进雾里，看到一枚铜钥匙静静躺在地上。雾中传来低语：「记住，钥匙开启的不只是门。」',
            summary: '李探长发现铜钥匙',
            wordCount: 47,
          },
        },
        review: null,
        archive: null,
        delivery: null,
        feedback: null,
      } as any,
      requirement: '',
    });

    expect(result.stateKey).toBe('story.sync');
    const artifact = result.artifact as any;
    expect(artifact.runId).toBe('run_novel_test');
    expect(artifact.chapterId).toBe('ch_001');
    expect(typeof artifact.summary).toBe('string');
    expect(Array.isArray(artifact.patches)).toBe(true);
    // 至少应输出一条 foreshadow 的 merge patch（章节里出现"钥匙"这种新元素）
    expect(artifact.patches.length).toBeGreaterThanOrEqual(1);
    for (const patch of artifact.patches) {
      expect(['set', 'merge', 'delete']).toContain(patch.action);
      expect(typeof patch.field).toBe('string');
      expect(typeof patch.fieldVersion).toBe('number');
      expect(patch.generatedBy).toBe('story-sync-agent');
    }
  });

  it('当章节内容缺失时降级为空 patches', async () => {
    const node = createStorySyncNode();
    const result = await node.run({
      run: {
        runId: 'run_novel_empty',
        status: 'running',
        currentNodeId: 'story-sync-agent',
        projectPath: '/tmp/x',
        completedNodes: [],
        pendingNodes: [],
        artifacts: {},
        review: null,
        archive: null,
        delivery: null,
        feedback: null,
      } as any,
      requirement: '',
    });
    const artifact = result.artifact as any;
    expect(artifact.patches).toEqual([]);
    expect(artifact.summary).toContain('skip');
  });

  it('保留 locked foreshadow，不重复提议覆盖', async () => {
    const node = createStorySyncNode();
    const result = await node.run({
      run: {
        runId: 'run_locked',
        status: 'running',
        currentNodeId: 'story-sync-agent',
        projectPath: '/tmp/x',
        completedNodes: [],
        pendingNodes: [],
        artifacts: {
          'context.chapterContext': {
            chapterId: 'ch_002',
            chapterNumber: 2,
            foreshadowRegistry: {
              items: [
                {
                  id: 'fs_lock_1',
                  title: '铜钥匙',
                  content: '铜钥匙是 locked 的',
                  status: 'planted',
                },
              ],
              version: 3,
              updatedBy: 'user',
            },
          },
          'chapter.candidate': {
            chapterId: 'ch_002',
            title: '第2章',
            content: '李探长再次看到铜钥匙。',
            wordCount: 12,
          },
        },
        review: null,
        archive: null,
        delivery: null,
        feedback: null,
      } as any,
      requirement: '',
    });
    const artifact = result.artifact as any;
    // 不应对已有 fs_lock_1 进行 set，可以是 merge 但不能创建同名条目
    const proposingDuplicate = artifact.patches.some(
      (p: any) => p.field === 'foreshadow_registry' && p.action === 'set'
    );
    expect(proposingDuplicate).toBe(false);
  });
});

describe('memory-extractor-agent', () => {
  it('从章节内容生成 StoryMemoryEntry 数组', async () => {
    const node = createMemoryExtractorNode();
    const result = await node.run({
      run: {
        runId: 'run_mem_1',
        status: 'running',
        currentNodeId: 'memory-extractor-agent',
        projectPath: '/tmp/x',
        completedNodes: [],
        pendingNodes: [],
        artifacts: {
          'context.chapterContext': {
            chapterId: 'ch_001',
            chapterNumber: 1,
            novelTitle: '暗城',
          },
          'chapter.candidate': {
            chapterId: 'ch_001',
            title: '第1章 暗夜',
            content: '李探长在码头发现一具尸体。死者手里攥着半张照片。',
            summary: '李探长发现尸体',
            wordCount: 30,
          },
        },
        review: null,
        archive: null,
        delivery: null,
        feedback: null,
      } as any,
      requirement: '',
    });

    expect(result.stateKey).toBe('memory.extracted');
    const artifact = result.artifact as any;
    expect(artifact.runId).toBe('run_mem_1');
    expect(artifact.chapterId).toBe('ch_001');
    expect(Array.isArray(artifact.entries)).toBe(true);
    expect(artifact.entries.length).toBeGreaterThanOrEqual(1);

    const entry = artifact.entries[0];
    expect(entry.novelId).toBeDefined();
    expect(entry.chapterId).toBe('ch_001');
    expect(entry.chapterNumber).toBe(1);
    expect(entry.memoryType).toBeTypeOf('string');
    expect(entry.title).toBeTypeOf('string');
    expect(entry.content).toBeTypeOf('string');
    expect(entry.importanceScore).toBeGreaterThanOrEqual(0);
    expect(entry.importanceScore).toBeLessThanOrEqual(1);
  });

  it('章节内容为空时返回空 entries', async () => {
    const node = createMemoryExtractorNode();
    const result = await node.run({
      run: {
        runId: 'run_mem_empty',
        status: 'running',
        currentNodeId: 'memory-extractor-agent',
        projectPath: '/tmp/x',
        completedNodes: [],
        pendingNodes: [],
        artifacts: {
          'context.chapterContext': { chapterId: 'ch_x', chapterNumber: 9 },
        },
        review: null,
        archive: null,
        delivery: null,
        feedback: null,
      } as any,
      requirement: '',
    });
    const artifact = result.artifact as any;
    expect(artifact.entries).toEqual([]);
  });
});

describe('novel pipeline 集成 — 包含 story sync + memory', () => {
  it('runNovelPipeline 在 chapter title 之后产出 story.sync 与 memory.extracted', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_RESPONSES_MOCK_JSON = JSON.stringify({
      __mock_by_node__: {
        'draft-writer-agent': {
          title: '第1章 暗夜',
          text: '李探长在码头发现一具尸体，手中握着铜钥匙。',
          wordCount: 24,
          chapterId: 'ch_a',
        },
        'multi-review-agent': { verdict: 'pass', summary: 'ok', dimensions: [], reasons: [] },
        'targeted-revision-agent': {
          title: '第1章 暗夜',
          text: '李探长在码头发现一具尸体，手中握着铜钥匙，钥匙上刻着字。',
          wordCount: 30,
          chapterId: 'ch_a',
          revisionNotes: ['加强氛围'],
        },
      },
    });

    const { runNovelPipeline } = await import('../src/engine/novelPipeline');
    const { existsSync, mkdirSync, rmSync, writeFileSync } = await import('node:fs');
    const path = (await import('node:path')).default;

    const tmp = path.join(process.cwd(), 'test-tmp-novel-mem');
    if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    mkdirSync(path.join(tmp, 'chapters'), { recursive: true });
    writeFileSync(
      path.join(tmp, 'project.yaml'),
      [
        'meta:',
        '  id: "00002"',
        '  name: "P4 测试"',
        '  type: novel',
        '  version: 1',
        '  created_at: "2026-05-03T00:00:00Z"',
        '  updated_at: "2026-05-03T00:00:00Z"',
        'outline:',
        '  title: "暗城"',
        '  acts: []',
        'storyboard:',
        '  shots: []',
        'novel:',
        '  chapters:',
        '    - id: ch_a',
        '      title: "第1章"',
        '      sort_order: 0',
        '      content_file: chapters/ch_a.md',
        '      status: draft',
        '      summary: "待生成"',
      ].join('\n'),
      'utf8'
    );

    try {
      const run = await runNovelPipeline({ projectPath: tmp, chapterId: 'ch_a', mode: 'generate' });
      expect(run.status).toBe('delivered');
      expect(run.completedNodes).toContain('story-sync-agent');
      expect(run.completedNodes).toContain('memory-extractor-agent');

      const sync = run.artifacts?.['story.sync'] as any;
      expect(sync).toBeDefined();
      expect(sync.chapterId).toBe('ch_a');
      expect(Array.isArray(sync.patches)).toBe(true);

      const mem = run.artifacts?.['memory.extracted'] as any;
      expect(mem).toBeDefined();
      expect(mem.chapterId).toBe('ch_a');
      expect(Array.isArray(mem.entries)).toBe(true);
    } finally {
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_RESPONSES_MOCK_JSON;
      if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
    }
  }, 60000);
});
