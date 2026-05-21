import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  applyPatchOperations,
  createEmptyProjectDocument,
  saveProject,
  loadProject,
  applyFieldPatches
} from '../sync/localProjectRepository';
import type { ProjectFieldPatch } from '@orison/shared-contracts';
import YAML from 'yaml';

const TEST_PROJECT_DIR = path.join(process.cwd(), 'test-tmp-local-project');

describe('local project repository helpers', () => {
  afterEach(() => {
    if (existsSync(TEST_PROJECT_DIR)) {
      rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  it('creates an empty local project document with storyboard root', () => {
    const project = createEmptyProjectDocument('Orison Demo');

    expect(project.meta.name).toBe('Orison Demo');
    expect(project.meta.type).toBe('novel');
    expect(project.storyboard.shots).toEqual([]);
  });

  it('applies a replace patch (no-op for removed outline paths)', () => {
    const project = createEmptyProjectDocument('Demo');

    const updated = applyPatchOperations(project, [
      {
        op: 'replace',
        path: 'outline.acts[0].summary',
        value: 'New value'
      }
    ]);

    expect(updated.meta.version).toBe(2);
  });

  it('saveProject / loadProject 往返一致', () => {
    const project = createEmptyProjectDocument('Round Trip Test');
    saveProject(TEST_PROJECT_DIR, project);

    const loaded = loadProject(TEST_PROJECT_DIR);
    expect(loaded).not.toBeNull();
    expect(loaded!.meta.name).toBe('Round Trip Test');
    expect(loaded!.meta.type).toBe('novel');
  });

  it('loadProject 对不存在的路径返回 null', () => {
    const loaded = loadProject(path.join(TEST_PROJECT_DIR, 'nonexistent'));
    expect(loaded).toBeNull();
  });

  it('saveProject 保存新创作字段后 loadProject 能读取', () => {
    const project = createEmptyProjectDocument('Creative Fields Test');
    const withFields = {
      ...project,
      world_setting: {
        premise: '永夜都市',
        era: '近未来',
        locations: [],
        rules: [],
        power_structures: [],
        taboos: [],
        visual_language: [],
        tone_rules: [],
        open_questions: []
      },
      asset_cards: [
        { id: 'c1', type: 'character' as const, name: '侦探', summary: '孤独调查者', tags: [], relationships: [], sourceRefs: [], status: 'active' as const, locked: false }
      ]
    };

    saveProject(TEST_PROJECT_DIR, withFields as any);
    const loaded = loadProject(TEST_PROJECT_DIR);

    expect(loaded!.world_setting).toBeDefined();
    expect(loaded!.world_setting!.premise).toBe('永夜都市');
    expect(loaded!.asset_cards).toBeDefined();
    expect(loaded!.asset_cards!.length).toBe(1);
    expect(loaded!.asset_cards![0].name).toBe('侦探');
  });

  it('applyFieldPatches 正确更新字段和元信息', () => {
    const project = createEmptyProjectDocument('Patch Test');
    saveProject(TEST_PROJECT_DIR, project);

    const fieldPatch: ProjectFieldPatch = {
      runId: 'run_test_123',
      createdAt: new Date().toISOString(),
      patches: [
        {
          field: 'world_setting',
          action: 'set',
          data: { premise: '赛博朋克', era: '2077', locations: [], rules: [], power_structures: [], taboos: [], visual_language: [], tone_rules: [], open_questions: [] },
          fieldVersion: 1,
          generatedBy: 'asset-loader-agent'
        },
        {
          field: 'asset_cards',
          action: 'set',
          data: [{ id: 'c1', type: 'character', name: 'V', summary: '主角', tags: [], relationships: [], sourceRefs: [], status: 'active', locked: false }],
          fieldVersion: 1,
          generatedBy: 'asset-loader-agent'
        }
      ]
    };

    const updated = applyFieldPatches(TEST_PROJECT_DIR, fieldPatch);

    expect(updated.world_setting).toBeDefined();
    expect(updated.world_setting!.premise).toBe('赛博朋克');
    expect(updated.asset_cards).toBeDefined();
    expect(updated.asset_cards!.length).toBe(1);
    expect(updated.field_metadata).toBeDefined();
    expect(updated.field_metadata!.world_setting).toBeDefined();
    expect(updated.field_metadata!.world_setting!.version).toBe(1);
    expect(updated.field_metadata!.world_setting!.source).toBe('agent');
    expect(updated.meta.version).toBe(2);
  });

  it('applyFieldPatches 支持 chapter_candidate 类型的补丁', () => {
    const project = createEmptyProjectDocument('Chapter Candidate Patch');
    // 预置一个章节（新结构：sections）
    const withNovel = {
      ...project,
      novel: {
        chapters: [
          {
            id: 'ch_001',
            title: '旧标题',
            sort_order: 0,
            sections: [{ id: 'ch_001_s1', sort_order: 0, content_file: 'chapters/ch_001.md' }],
            status: 'generating',
            last_run_id: 'run_pre',
          },
        ],
      },
    };
    saveProject(TEST_PROJECT_DIR, withNovel as any);

    const chapterPatch = {
      runId: 'run_candidate_1',
      createdAt: new Date().toISOString(),
      patches: [
        {
          field: 'chapter_candidate' as any,
          action: 'set' as const,
          data: {
            chapterId: 'ch_001',
            runId: 'run_candidate_1',
            candidate: {
              title: '第1章 新标题',
              content: '更新后的章节内容。',
              summary: '新摘要。',
              wordCount: 42,
            },
          },
          fieldVersion: 1,
          generatedBy: 'draft-writer-agent',
        },
      ],
    };

    const updated = applyFieldPatches(TEST_PROJECT_DIR, chapterPatch);

    // 验证章节元数据已更新
    expect(updated.novel).toBeDefined();
    expect(updated.novel!.chapters[0].title).toBe('第1章 新标题');
    expect(updated.novel!.chapters[0].summary).toBe('新摘要。');
    expect(updated.novel!.chapters[0].word_count).toBe(42);
    expect(updated.novel!.chapters[0].status).toBe('draft');

    // 验证 meta version 递增
    expect(updated.meta.version).toBe(2);
  });

  it('旧格式文档（含 assets.characters）加载时自动派生 asset_cards', () => {
    const project = createEmptyProjectDocument('Legacy Test');
    const withOldAssets = {
      ...project,
      assets: {
        characters: [
          { id: 'char_1', name: '张三', appearance: '高大', personality: '沉稳' }
        ],
        locations: [
          { id: 'loc_1', name: '办公室', description: '现代风格' }
        ]
      }
    };

    saveProject(TEST_PROJECT_DIR, withOldAssets as any);
    const loaded = loadProject(TEST_PROJECT_DIR);

    expect(loaded!.assets).toBeDefined();
    expect(loaded!.asset_cards).toBeDefined();
    expect(loaded!.asset_cards!.length).toBe(1);
    expect(loaded!.asset_cards![0].name).toBe('张三');
    expect(loaded!.asset_cards![0].type).toBe('character');
  });

  it('旧格式 outline 会迁移到 outline_v2，而不是被直接丢弃', () => {
    const project = createEmptyProjectDocument('Legacy Outline Test');
    const withLegacyOutline = {
      ...project,
      outline: {
        title: '旧提纲标题',
        logline: '旧 logline',
        genre: '悬疑',
        theme: '真相与背叛',
        acts: [
          { id: 'act_1', title: '开端', summary: '主角进入案件' },
          { id: 'act_2', title: '反转', summary: '真凶浮现' },
        ],
      },
    };

    mkdirSync(TEST_PROJECT_DIR, { recursive: true });
    writeFileSync(path.join(TEST_PROJECT_DIR, 'project.yaml'), YAML.stringify(withLegacyOutline), 'utf8');
    const loaded = loadProject(TEST_PROJECT_DIR);

    expect(loaded!.outline_v2).toBeDefined();
    expect(loaded!.meta.logline).toBe('旧 logline');
    expect(loaded!.meta.genre).toBe('悬疑');
    expect(loaded!.meta.theme).toBe('真相与背叛');
    expect(loaded!.meta.synopsis).toContain('开端');
    expect(loaded!.meta.synopsis).toContain('主角进入案件');
    expect(loaded!.outline_v2!.major_turning_points).toContain('反转');
  });
});
