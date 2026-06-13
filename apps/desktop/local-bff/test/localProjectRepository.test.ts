import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  applyPatchOperations,
  createEmptyProjectDocument,
  saveProject,
  loadProject,
  applyFieldPatches,
  bootstrapProjectFromMeta,
  migrateLegacyProjectJson
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

  it('bootstrapProjectFromMeta 从 project.json 重建文档并保留全部 meta 字段', () => {
    mkdirSync(TEST_PROJECT_DIR, { recursive: true });
    writeFileSync(
      path.join(TEST_PROJECT_DIR, 'project.json'),
      JSON.stringify({
        name: '剧本项目', type: 'script',
        logline: 'L', synopsis: 'S', genre: 'G', theme: 'T', writing_style: 'W', tone: 'TN'
      }),
      'utf8'
    );

    const doc = bootstrapProjectFromMeta(TEST_PROJECT_DIR);

    expect(doc.meta.name).toBe('剧本项目');
    expect(doc.meta.type).toBe('script');
    expect(doc.meta.logline).toBe('L');
    expect(doc.meta.synopsis).toBe('S');
    expect(doc.meta.genre).toBe('G');
    expect(doc.meta.theme).toBe('T');
    expect(doc.meta.writing_style).toBe('W');
    expect(doc.meta.tone).toBe('TN');
    // 纯内存构造，不应自行落盘。
    expect(existsSync(path.join(TEST_PROJECT_DIR, 'project.yaml'))).toBe(false);
  });

  it('bootstrapProjectFromMeta 无 project.json 时用目录名兜底', () => {
    mkdirSync(TEST_PROJECT_DIR, { recursive: true });

    const doc = bootstrapProjectFromMeta(TEST_PROJECT_DIR);

    expect(doc.meta.name).toBe(path.basename(TEST_PROJECT_DIR));
    expect(doc.meta.type).toBe('novel');
  });

  it('migrateLegacyProjectJson 把 project.json 收敛进 project.yaml（含 coverImage/projectId）并删除 json', () => {
    mkdirSync(TEST_PROJECT_DIR, { recursive: true });
    writeFileSync(
      path.join(TEST_PROJECT_DIR, 'project.json'),
      JSON.stringify({
        name: '迁移项目', type: 'script', logline: 'L', synopsis: 'S',
        coverImage: 'assets/cover.png', projectId: '12345'
      }),
      'utf8'
    );

    const doc = migrateLegacyProjectJson(TEST_PROJECT_DIR);

    expect(doc).not.toBeNull();
    expect(doc!.meta.name).toBe('迁移项目');
    expect(doc!.meta.type).toBe('script');
    expect(doc!.meta.logline).toBe('L');
    expect(doc!.meta.synopsis).toBe('S');
    expect(doc!.meta.cover_image).toBe('assets/cover.png');
    expect(doc!.meta.project_id).toBe('12345');
    // json 被删除，yaml 成为唯一真相源
    expect(existsSync(path.join(TEST_PROJECT_DIR, 'project.json'))).toBe(false);
    expect(existsSync(path.join(TEST_PROJECT_DIR, 'project.yaml'))).toBe(true);
    // 重新加载一致
    const reloaded = loadProject(TEST_PROJECT_DIR);
    expect(reloaded!.meta.cover_image).toBe('assets/cover.png');
    expect(reloaded!.meta.project_id).toBe('12345');
  });

  it('migrateLegacyProjectJson 已有 project.yaml 时仅补缺字段，不覆盖 yaml 既有值', () => {
    mkdirSync(TEST_PROJECT_DIR, { recursive: true });
    // yaml 已有 logline，json 带不同 logline + 额外 coverImage
    saveProject(TEST_PROJECT_DIR, createEmptyProjectDocument('Yaml 名', 'novel', { logline: 'yaml-logline' }));
    writeFileSync(
      path.join(TEST_PROJECT_DIR, 'project.json'),
      JSON.stringify({ name: 'Json 名', logline: 'json-logline', coverImage: 'c.png' }),
      'utf8'
    );

    const doc = migrateLegacyProjectJson(TEST_PROJECT_DIR);

    expect(doc!.meta.name).toBe('Yaml 名');           // yaml 既有 name 不被覆盖
    expect(doc!.meta.logline).toBe('yaml-logline');    // yaml 既有 logline 不被覆盖
    expect(doc!.meta.cover_image).toBe('c.png');        // yaml 缺失的字段从 json 补齐
    expect(existsSync(path.join(TEST_PROJECT_DIR, 'project.json'))).toBe(false);
  });

  it('migrateLegacyProjectJson 无 json 时返回现有 yaml（或 null），不做写删', () => {
    mkdirSync(TEST_PROJECT_DIR, { recursive: true });
    expect(migrateLegacyProjectJson(TEST_PROJECT_DIR)).toBeNull();

    saveProject(TEST_PROJECT_DIR, createEmptyProjectDocument('仅 yaml', 'novel'));
    const doc = migrateLegacyProjectJson(TEST_PROJECT_DIR);
    expect(doc!.meta.name).toBe('仅 yaml');
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

  it('applyFieldPatches 跳过 fieldVersion 早于当前版本的过期补丁', () => {
    const project = createEmptyProjectDocument('Stale Patch Test');
    saveProject(TEST_PROJECT_DIR, project);

    // 先写入 version 3 的字段
    applyFieldPatches(TEST_PROJECT_DIR, {
      runId: 'run_v3',
      createdAt: new Date().toISOString(),
      patches: [{
        field: 'world_setting',
        action: 'set',
        data: { premise: '当前内容', era: '', locations: [], rules: [], power_structures: [], taboos: [], visual_language: [], tone_rules: [], open_questions: [] },
        fieldVersion: 3,
        generatedBy: 'agent-a'
      }]
    });

    // 再尝试用 version 2(过期)的补丁覆盖,应被跳过
    const updated = applyFieldPatches(TEST_PROJECT_DIR, {
      runId: 'run_v2_stale',
      createdAt: new Date().toISOString(),
      patches: [{
        field: 'world_setting',
        action: 'set',
        data: { premise: '过期内容', era: '', locations: [], rules: [], power_structures: [], taboos: [], visual_language: [], tone_rules: [], open_questions: [] },
        fieldVersion: 2,
        generatedBy: 'agent-b'
      }]
    });

    expect(updated.world_setting!.premise).toBe('当前内容');
    expect(updated.field_metadata!.world_setting!.version).toBe(3);
  });

  it('loadProject 对空或损坏的 project.yaml 返回 null 而非抛错', () => {
    mkdirSync(TEST_PROJECT_DIR, { recursive: true });
    // 空文件 -> YAML.parse 得到 null
    writeFileSync(path.join(TEST_PROJECT_DIR, 'project.yaml'), '', 'utf8');
    expect(loadProject(TEST_PROJECT_DIR)).toBeNull();

    // 标量(非对象)内容
    writeFileSync(path.join(TEST_PROJECT_DIR, 'project.yaml'), 'just-a-string', 'utf8');
    expect(loadProject(TEST_PROJECT_DIR)).toBeNull();
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
