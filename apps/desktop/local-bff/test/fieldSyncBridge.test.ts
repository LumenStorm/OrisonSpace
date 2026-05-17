import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createEmptyProjectDocument, saveProject, loadProject } from '../sync/localProjectRepository';
import { onFieldEdited } from '../sync/fieldSyncBridge';

const TEST_PROJECT_DIR = path.join(process.cwd(), 'test-tmp-field-sync');

describe('fieldSyncBridge', () => {
  afterEach(() => {
    if (existsSync(TEST_PROJECT_DIR)) {
      rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  it('编辑 relationship_graph 后生成 sync event 并标记下游 stale', () => {
    const project = createEmptyProjectDocument('Sync Test');
    saveProject(TEST_PROJECT_DIR, project);

    const newGraph = {
      nodes: [{ id: 'n1', assetCardId: 'c1', label: '侦探', type: 'character', locked: false }],
      edges: [{ id: 'e1', from: 'n1', to: 'n1', relationType: 'rivalry', strength: 5, polarity: 'positive', visibility: 'public', locked: false }],
      version: 1,
      updatedBy: 'user'
    };

    const { syncEvent, staleFields } = onFieldEdited(
      TEST_PROJECT_DIR,
      'relationship_graph',
      newGraph
    );

    // 验证 sync event
    expect(syncEvent.id).toMatch(/^evt_/);
    expect(syncEvent.source).toBe('user');
    expect(syncEvent.field).toBe('relationship_graph');
    expect(syncEvent.fromVersion).toBe(0);
    expect(syncEvent.toVersion).toBe(1);

    // 验证下游 stale 字段
    expect(staleFields).toContain('world_setting');
    expect(staleFields).toContain('outline');
    expect(staleFields).toContain('episode_outlines');
    expect(staleFields).toContain('growth_curve');
    expect(staleFields).toContain('pacing_curve');
    expect(staleFields).toContain('emotion_curve');
  });

  it('编辑 outline 后只标记曲线和集纲为 stale', () => {
    const project = createEmptyProjectDocument('Outline Sync');
    saveProject(TEST_PROJECT_DIR, project);

    const { staleFields } = onFieldEdited(
      TEST_PROJECT_DIR,
      'outline',
      { title: '新大纲', logline: '测试', central_conflict: '冲突', synopsis: '故事梗概', major_turning_points: [], ending_direction: '结局' }
    );

    expect(staleFields).toContain('growth_curve');
    expect(staleFields).toContain('pacing_curve');
    expect(staleFields).toContain('emotion_curve');
    expect(staleFields).toContain('episode_outlines');
    expect(staleFields).not.toContain('outline');
    expect(staleFields).not.toContain('asset_cards');
    expect(staleFields).not.toContain('relationship_graph');
  });

  it('编辑后 field_metadata 版本递增且 stale 字段被标记', () => {
    const project = createEmptyProjectDocument('Meta Test');
    saveProject(TEST_PROJECT_DIR, project);

    onFieldEdited(TEST_PROJECT_DIR, 'asset_cards', [
      { id: 'c1', type: 'character', name: '测试', summary: '测试角色', tags: [], relationships: [], sourceRefs: [], status: 'active', locked: false }
    ]);

    // 再次读取验证持久化
    const loaded = loadProject(TEST_PROJECT_DIR);
    expect(loaded).not.toBeNull();

    expect(loaded!.field_metadata!.asset_cards!.version).toBe(1);
    expect(loaded!.field_metadata!.asset_cards!.source).toBe('user');
    expect(loaded!.field_metadata!.asset_cards!.stale).toBe(false);

    // 下游应被标记 stale
    expect(loaded!.field_metadata!.world_setting!.stale).toBe(true);
    expect(loaded!.field_metadata!.outline!.stale).toBe(true);
    expect(loaded!.field_metadata!.episode_outlines!.stale).toBe(true);
  });

  it('编辑 foreshadow_registry 后标记 episode_outlines 为 stale', () => {
    const project = createEmptyProjectDocument('Foreshadow Sync');
    saveProject(TEST_PROJECT_DIR, project);

    const newForeshadow = {
      items: [
        { id: 'fs_001', title: '伏笔线索', content: '一个关键线索...' }
      ]
    };

    const { syncEvent, staleFields } = onFieldEdited(
      TEST_PROJECT_DIR,
      'foreshadow_registry',
      newForeshadow
    );

    expect(syncEvent.field).toBe('foreshadow_registry');
    expect(syncEvent.toVersion).toBe(1);

    // foreshadow_registry 下游：episode_outlines
    expect(staleFields).toContain('episode_outlines');

    // 确认持久化：foreshadow_registry 的 key 被正确写入
    const loaded = loadProject(TEST_PROJECT_DIR);
    expect(loaded!.foreshadow_registry).toBeDefined();
    expect(loaded!.field_metadata!.foreshadow_registry!.version).toBe(1);
    expect(loaded!.field_metadata!.episode_outlines!.stale).toBe(true);
  });

  it('编辑 asset_cards 后 foreshadow_registry 也应标记为 stale', () => {
    const project = createEmptyProjectDocument('Asset to Foreshadow');
    saveProject(TEST_PROJECT_DIR, project);

    const newAssets = [
      { id: 'c1', type: 'character' as const, name: '新角色', summary: '', tags: [], relationships: [], sourceRefs: [], status: 'active' as const, locked: false }
    ];

    const { staleFields } = onFieldEdited(TEST_PROJECT_DIR, 'asset_cards', newAssets);

    expect(staleFields).toContain('foreshadow_registry');
  });

  it('编辑 locked 字段时抛出错误', () => {
    const project = createEmptyProjectDocument('Lock Test');
    saveProject(TEST_PROJECT_DIR, project);

    // 先写入一次以创建 metadata，然后手动锁定
    onFieldEdited(TEST_PROJECT_DIR, 'world_setting', {
      premise: '初始', era: '', locations: [], rules: [],
      power_structures: [], taboos: [], visual_language: [], tone_rules: [], open_questions: []
    });

    // 手动锁定字段
    const loaded = loadProject(TEST_PROJECT_DIR)!;
    const locked = {
      ...loaded,
      field_metadata: {
        ...loaded.field_metadata,
        world_setting: { ...loaded.field_metadata!.world_setting!, locked: true }
      }
    };
    saveProject(TEST_PROJECT_DIR, locked);

    // 尝试编辑 locked 字段应抛出
    expect(() => onFieldEdited(TEST_PROJECT_DIR, 'world_setting', {
      premise: '被锁定不应写入', era: '', locations: [], rules: [],
      power_structures: [], taboos: [], visual_language: [], tone_rules: [], open_questions: []
    })).toThrow('locked');
  });
});
