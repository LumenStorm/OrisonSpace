import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { createNovelAutoModeRunner } from '../src/engine/autoMode/novelAutoModeRunner';

/**
 * Phase 6: Novel Auto Mode Runner 单元测试。
 *
 * 测试覆盖：
 * 1. 自动选择下一个未完成章节（按 sort_order 升序）
 * 2. 调用 novelPipeline 生成章节并把已完成的章节加入 completed
 * 3. 暂停后保留状态，恢复后继续未完成
 * 4. 取消立即停止并标记 cancelled
 */

const TEST_DIR = path.join(process.cwd(), 'test-tmp-auto-mode');

const PROJECT_YAML = [
  'meta:',
  '  id: "00100"',
  '  name: "P6 Auto Test"',
  '  type: novel',
  '  version: 1',
  '  created_at: "2026-05-03T00:00:00Z"',
  '  updated_at: "2026-05-03T00:00:00Z"',
  'outline:',
  '  title: "P6"',
  '  acts: []',
  'storyboard:',
  '  shots: []',
  'novel:',
  '  chapters:',
  '    - id: ch_a',
  '      title: "第1章"',
  '      sort_order: 0',
  '      content_file: chapters/ch_a.md',
  '      status: final',
  '      summary: "已完成"',
  '    - id: ch_b',
  '      title: "第2章"',
  '      sort_order: 1',
  '      content_file: chapters/ch_b.md',
  '      status: draft',
  '      summary: ""',
  '    - id: ch_c',
  '      title: "第3章"',
  '      sort_order: 2',
  '      content_file: chapters/ch_c.md',
  '      status: draft',
  '      summary: ""',
].join('\n');

const MOCK_BY_NODE = JSON.stringify({
  __mock_by_node__: {
    'draft-writer-agent': {
      title: '第N章 自动',
      text: '自动生成的章节内容。',
      wordCount: 12,
      chapterId: 'auto',
    },
    'multi-review-agent': { verdict: 'pass', summary: 'ok', dimensions: [], reasons: [] },
    'targeted-revision-agent': {
      title: '第N章 自动',
      text: '修订后的内容。',
      wordCount: 8,
      chapterId: 'auto',
      revisionNotes: [],
    },
  },
});

function setupProject() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(path.join(TEST_DIR, 'chapters'), { recursive: true });
  writeFileSync(path.join(TEST_DIR, 'project.yaml'), PROJECT_YAML, 'utf8');
  writeFileSync(path.join(TEST_DIR, 'chapters/ch_a.md'), '# 第1章\n\n已完成内容。', 'utf8');
}

describe('novel auto mode runner', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_RESPONSES_MOCK_JSON = MOCK_BY_NODE;
    setupProject();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RESPONSES_MOCK_JSON;
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('start 自动选择 status != final 的章节作为待办列表', async () => {
    const runner = createNovelAutoModeRunner();
    const state = await runner.start({ projectPath: TEST_DIR, mode: 'generate' });

    expect(state.status).toBe('awaiting_approval');
    expect(state.planning?.status).toBe('generated');
    expect(state.totalChapters).toBe(2); // 只有 ch_b 和 ch_c 待生成
    expect(state.pendingChapterIds).toEqual(['ch_b', 'ch_c']);
    expect(state.completedChapterIds).toEqual([]);
    expect(state.autoModeId).toMatch(/^auto_/);
  });

  it('start bootstraps planning and chapter slots for a desktop project with only project.json', async () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      path.join(TEST_DIR, 'project.json'),
      JSON.stringify({ name: '43', type: 'novel', projectId: null }, null, 2),
      'utf8',
    );

    const runner = createNovelAutoModeRunner();
    const state = await runner.start({
      projectPath: TEST_DIR,
      mode: 'generate',
      plotSummary: 'A city records every lie as public weather.',
    });

    expect(state.status).toBe('awaiting_approval');
    expect(state.pendingChapterIds).toEqual(['ch_001', 'ch_002', 'ch_003', 'ch_004', 'ch_005', 'ch_006']);
    const project = YAML.parse(readFileSync(path.join(TEST_DIR, 'project.yaml'), 'utf8')) as any;
    expect(project.meta.name).toBe('43');
    expect(project.novel.chapters).toHaveLength(6);
  });

  it('提供显式 chapterIds 时使用它们而非自动选择', async () => {
    const runner = createNovelAutoModeRunner();
    const state = await runner.start({
      projectPath: TEST_DIR,
      chapterIds: ['ch_c'],
      mode: 'generate',
    });
    expect(state.totalChapters).toBe(1);
    expect(state.pendingChapterIds).toEqual(['ch_c']);
  });

  it('runOnce 推进一章后该章节进入 completed', { timeout: 60000 }, async () => {
    const runner = createNovelAutoModeRunner();
    await runner.start({ projectPath: TEST_DIR, mode: 'generate' });
    await runner.approvePlan();

    const next = await runner.runOnce();
    expect(next.completedChapterIds).toContain('ch_b');
    expect(next.pendingChapterIds).toEqual(['ch_c']);
    expect(next.currentRunId).toBeTruthy();
  });

  it('runOnce uses the selected novel model runtime config', { timeout: 60000 }, async () => {
    delete process.env.OPENAI_API_KEY;
    const runner = createNovelAutoModeRunner();
    await runner.start({
      projectPath: TEST_DIR,
      mode: 'generate',
      modelRuntime: {
        keyId: 'key_001',
        modelId: 'gpt-selected',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'request-scoped-key',
      },
    });
    await runner.approvePlan();

    const next = await runner.runOnce();
    expect(next.completedChapterIds).toContain('ch_b');
  });

  it('全部 runOnce 后状态变为 completed', { timeout: 120000 }, async () => {
    const runner = createNovelAutoModeRunner();
    await runner.start({ projectPath: TEST_DIR, mode: 'generate' });
    await runner.approvePlan();
    await runner.runOnce();
    await runner.runOnce();
    const final = await runner.runOnce();
    expect(final.status).toBe('completed');
    expect(final.completedChapterIds).toEqual(['ch_b', 'ch_c']);
    expect(final.pendingChapterIds).toEqual([]);
  });

  it('pause 阻止 runOnce 推进，resume 后继续', { timeout: 60000 }, async () => {
    const runner = createNovelAutoModeRunner();
    await runner.start({ projectPath: TEST_DIR, mode: 'generate' });
    await runner.approvePlan();

    runner.pause();
    expect(runner.getState().status).toBe('paused');

    // pause 后调用 runOnce 应当不推进
    const paused = await runner.runOnce();
    expect(paused.status).toBe('paused');
    expect(paused.completedChapterIds).toEqual([]);

    runner.resume();
    expect(runner.getState().status).toBe('running');

    const advanced = await runner.runOnce();
    expect(advanced.completedChapterIds).toContain('ch_b');
  });

  it('cancel 立即标记 cancelled，runOnce 不再执行', async () => {
    const runner = createNovelAutoModeRunner();
    await runner.start({ projectPath: TEST_DIR, mode: 'generate' });
    await runner.approvePlan();
    runner.cancel();
    const state = runner.getState();
    expect(state.status).toBe('cancelled');

    const after = await runner.runOnce();
    expect(after.status).toBe('cancelled');
    expect(after.completedChapterIds).toEqual([]);
  });

  it('未启动直接 runOnce 抛错', async () => {
    const runner = createNovelAutoModeRunner();
    await expect(runner.runOnce()).rejects.toThrow(/not started/i);
  });

  it('对不存在的项目抛错', async () => {
    const runner = createNovelAutoModeRunner();
    await expect(
      runner.start({ projectPath: path.join(TEST_DIR, '不存在'), mode: 'generate' })
    ).rejects.toThrow(/project/i);
  });
});
