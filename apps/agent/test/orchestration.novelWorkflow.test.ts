import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRunService } from '../src/engine/runService';

/**
 * Novel chapter workflow 集成测试。
 * 验证 novel pipeline 可以：
 * 1. 从 local project 加载章节上下文
 * 2. 通过 python 节点生成章节草稿
 * 3. 产出 chapter_candidate 结果
 */

const TEST_PROJECT_DIR = path.join(process.cwd(), 'test-tmp-novel-workflow');

const MOCK_BY_NODE = JSON.stringify({
  __mock_by_node__: {
    'draft-writer-agent': {
      title: '第1章 暗夜降临',
      text: '夜幕降临时，李探长踏入了暗城。\n\n街道上空无一人，只有昏黄的路灯在雾气中摇曳。',
      wordCount: 47,
      chapterId: 'ch_001',
    },
    'multi-review-agent': {
      verdict: 'pass',
      summary: '质量达标',
      dimensions: [
        { name: 'structure', score: 8, comment: '结构完整' },
        { name: 'prose', score: 7, comment: '文笔流畅' },
      ],
      reasons: [],
    },
    'targeted-revision-agent': {
      title: '第1章 暗夜降临',
      text: '夜幕降临时，李探长踏入了暗城。\n\n街道上空无一人，只有昏黄的路灯在雾气中摇曳。\n\n修订版：增加了环境细节。',
      wordCount: 67,
      chapterId: 'ch_001',
    },
  },
});

describe('novel chapter workflow', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_RESPONSES_MOCK_JSON = MOCK_BY_NODE;

    // 创建测试项目目录和 project.yaml
    if (!existsSync(TEST_PROJECT_DIR)) {
      mkdirSync(TEST_PROJECT_DIR, { recursive: true });
    }
    if (!existsSync(path.join(TEST_PROJECT_DIR, 'chapters'))) {
      mkdirSync(path.join(TEST_PROJECT_DIR, 'chapters'));
    }

    // 写入 project.yaml（包含 novel.chapters）
    writeFileSync(
      path.join(TEST_PROJECT_DIR, 'project.yaml'),
      [
        'meta:',
        '  id: "00001"',
        '  name: "测试小说"',
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
        '    - id: ch_001',
        '      title: "第1章"',
        '      sort_order: 0',
        '      content_file: chapters/ch_001.md',
        '      status: draft',
        '      summary: "待生成"',
        '    - id: ch_002',
        '      title: "第2章"',
        '      sort_order: 1',
        '      content_file: chapters/ch_002.md',
        '      status: generating',
        '      last_run_id: run_prev',
      ].join('\n'),
      'utf8'
    );

    // 写入第一个章节 markdown（已存在）
    writeFileSync(
      path.join(TEST_PROJECT_DIR, 'chapters/ch_001.md'),
      '# 第1章\n\n李探长接到了失踪案的电话。\n\n他站在窗前，望着永夜的城市。',
      'utf8'
    );
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RESPONSES_MOCK_JSON;
    if (existsSync(TEST_PROJECT_DIR)) {
      rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  it('startNovelChapter 通过 novel pipeline 生成章节', { timeout: 60000 }, async () => {
    const service = createRunService();

    const run = await service.startNovelChapter({
      projectPath: TEST_PROJECT_DIR,
      chapterId: 'ch_002',
      mode: 'generate',
    });

    // 验证基本信息
    expect(run.runId).toMatch(/^run_novel_/);
    expect(run.status).toBe('delivered');

    // 验证上下文加载节点已完成
    expect(run.completedNodes).toContain('context-loader-agent');
    expect(run.completedNodes).toContain('chapter-bridge-agent');

    // 验证 artifacts 包含上下文信息
    const context = run.artifacts?.['context.chapterContext'] as Record<string, unknown> | undefined;
    expect(context).toBeDefined();
    expect(context?.chapterId).toBe('ch_002');
    expect(context?.novelTitle).toBe('暗城');

    // 验证 chapter_candidate 存在于 artifacts
    const candidate = run.artifacts?.['chapter.candidate'] as Record<string, unknown> | undefined;
    expect(candidate).toBeDefined();
    expect(candidate?.title).toBe('第1章 暗夜降临');
    expect(candidate?.content).toBeDefined();
    expect(typeof candidate?.content).toBe('string');
    expect((candidate?.content as string).length).toBeGreaterThan(0);
  });

  it('startNovelChapter 的 continue 模式加载已有草稿', { timeout: 60000 }, async () => {
    const service = createRunService();

    const run = await service.startNovelChapter({
      projectPath: TEST_PROJECT_DIR,
      chapterId: 'ch_001',
      mode: 'continue',
      instruction: '继续扩写这章',
    });

    // continue 模式应加载已有章节内容
    const context = run.artifacts?.['context.chapterContext'] as Record<string, unknown> | undefined;
    expect(context?.draftText).toBeDefined();
    expect(typeof context?.draftText).toBe('string');
    expect((context?.draftText as string).length).toBeGreaterThan(0);
    expect(context?.chapterId).toBe('ch_001');
  });

  it('startNovelChapter 对不存在的项目路径抛错', async () => {
    const service = createRunService();

    await expect(
      service.startNovelChapter({
        projectPath: path.join(TEST_PROJECT_DIR, '不存在'),
        chapterId: 'ch_001',
        mode: 'generate',
      })
    ).rejects.toThrow(/project/i);
  });

  it('startNovelChapter 对不存在的章节 ID 抛错', async () => {
    const service = createRunService();

    await expect(
      service.startNovelChapter({
        projectPath: TEST_PROJECT_DIR,
        chapterId: 'ch_nonexistent',
        mode: 'generate',
      })
    ).rejects.toThrow(/chapter/i);
  });

  it('creative run 旧行为不受影响', { timeout: 60000 }, async () => {
    const service = createRunService();
    const run = await service.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'test',
      configRoot: 'I:/workspace/demo/project-config/agents',
    });

    expect(run.runId).toMatch(/^run_/);
    // 旧 pipeline 也应完成（mock 覆盖了所有 python 节点）
    expect(['delivered', 'approved', 'human_in_loop']).toContain(run.status);
  });
});
