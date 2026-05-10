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

  it('editing relationship_graph creates a sync event and marks downstream fields stale', () => {
    const project = createEmptyProjectDocument('Sync Test');
    saveProject(TEST_PROJECT_DIR, project);

    const newGraph = {
      nodes: [{ id: 'n1', assetCardId: 'c1', label: '侦探', type: 'character', locked: false }],
      edges: [
        {
          id: 'e1',
          from: 'n1',
          to: 'n1',
          relationType: 'rivalry',
          strength: 5,
          polarity: 'positive',
          visibility: 'public',
          locked: false,
        },
      ],
      version: 1,
      updatedBy: 'user',
    };

    const { syncEvent, staleFields } = onFieldEdited(TEST_PROJECT_DIR, 'relationship_graph', newGraph);

    expect(syncEvent.id).toMatch(/^evt_/);
    expect(syncEvent.source).toBe('user');
    expect(syncEvent.field).toBe('relationship_graph');
    expect(syncEvent.fromVersion).toBe(0);
    expect(syncEvent.toVersion).toBe(1);

    expect(staleFields).toContain('world_setting');
    expect(staleFields).toContain('outline');
    expect(staleFields).toContain('episode_outlines');
    expect(staleFields).toContain('growth_curve');
    expect(staleFields).toContain('pacing_curve');
    expect(staleFields).toContain('emotion_curve');
  });

  it('editing outline only marks curves and episode outlines as stale', () => {
    const project = createEmptyProjectDocument('Outline Sync');
    saveProject(TEST_PROJECT_DIR, project);

    const { staleFields } = onFieldEdited(TEST_PROJECT_DIR, 'outline', {
      title: '新大纲',
      logline: '测试',
      central_conflict: '冲突',
      acts: [],
      major_turning_points: [],
      ending_direction: '结局',
    });

    expect(staleFields).toContain('growth_curve');
    expect(staleFields).toContain('pacing_curve');
    expect(staleFields).toContain('emotion_curve');
    expect(staleFields).toContain('episode_outlines');
    expect(staleFields).not.toContain('outline');
    expect(staleFields).not.toContain('asset_cards');
    expect(staleFields).not.toContain('relationship_graph');
  });

  it('editing asset_cards increments metadata and persists stale downstream fields', () => {
    const project = createEmptyProjectDocument('Meta Test');
    saveProject(TEST_PROJECT_DIR, project);

    onFieldEdited(TEST_PROJECT_DIR, 'asset_cards', [
      {
        id: 'c1',
        type: 'character',
        name: '测试',
        summary: '测试角色',
        tags: [],
        relationships: [],
        sourceRefs: [],
        status: 'active',
        locked: false,
      },
    ]);

    const loaded = loadProject(TEST_PROJECT_DIR);
    expect(loaded).not.toBeNull();
    expect(loaded!.field_metadata!.asset_cards!.version).toBe(1);
    expect(loaded!.field_metadata!.asset_cards!.source).toBe('user');
    expect(loaded!.field_metadata!.asset_cards!.stale).toBe(false);
    expect(loaded!.field_metadata!.world_setting!.stale).toBe(true);
    expect(loaded!.field_metadata!.outline!.stale).toBe(true);
    expect(loaded!.field_metadata!.episode_outlines!.stale).toBe(true);
  });

  it('editing foreshadow_registry marks episode_outlines stale', () => {
    const project = createEmptyProjectDocument('Foreshadow Sync');
    saveProject(TEST_PROJECT_DIR, project);

    const newForeshadow = {
      items: [{ id: 'fs_001', title: '伏笔线索', content: '一个关键线索。' }],
    };

    const { syncEvent, staleFields } = onFieldEdited(
      TEST_PROJECT_DIR,
      'foreshadow_registry',
      newForeshadow,
    );

    expect(syncEvent.field).toBe('foreshadow_registry');
    expect(syncEvent.toVersion).toBe(1);
    expect(staleFields).toContain('episode_outlines');

    const loaded = loadProject(TEST_PROJECT_DIR);
    expect(loaded!.foreshadow_registry).toBeDefined();
    expect(loaded!.field_metadata!.foreshadow_registry!.version).toBe(1);
    expect(loaded!.field_metadata!.episode_outlines!.stale).toBe(true);
  });

  it('editing asset_cards also marks foreshadow_registry stale', () => {
    const project = createEmptyProjectDocument('Asset to Foreshadow');
    saveProject(TEST_PROJECT_DIR, project);

    const newAssets = [
      {
        id: 'c1',
        type: 'character' as const,
        name: '新角色',
        summary: '',
        tags: [],
        relationships: [],
        sourceRefs: [],
        status: 'active' as const,
        locked: false,
      },
    ];

    const { staleFields } = onFieldEdited(TEST_PROJECT_DIR, 'asset_cards', newAssets);
    expect(staleFields).toContain('foreshadow_registry');
  });

  it('editing a supported archive card writes the dossier YAML file', () => {
    const project = createEmptyProjectDocument('Archive Field Edit');
    saveProject(TEST_PROJECT_DIR, project);

    onFieldEdited(TEST_PROJECT_DIR, 'asset_cards', [
      {
        id: 'char_lin_qi',
        type: 'character',
        name: '林七',
        summary: '冷静克制的调查员',
        tags: ['主角'],
        relationships: [],
        sourceRefs: ['assets/characters/lin-qi.yaml'],
        status: 'active',
        archive: {
          path: 'assets/characters/lin-qi.yaml',
          slug: 'lin-qi',
          schemaVersion: 1,
        },
        visuals: {
          primaryImage: 'assets/images/lin-qi-main.png',
          gallery: [
            {
              id: 'img_main',
              path: 'assets/images/lin-qi-main.png',
              kind: 'primary',
            },
          ],
        },
        details: {
          profile: {
            role: '主角',
          },
        },
      },
    ] as any);

    expect(
      existsSync(path.join(TEST_PROJECT_DIR, 'assets', 'characters', 'lin-qi.yaml')),
    ).toBe(true);
  });

  it('editing a locked field throws', () => {
    const project = createEmptyProjectDocument('Lock Test');
    saveProject(TEST_PROJECT_DIR, project);

    onFieldEdited(TEST_PROJECT_DIR, 'world_setting', {
      premise: '初始',
      era: '',
      locations: [],
      rules: [],
      power_structures: [],
      taboos: [],
      visual_language: [],
      tone_rules: [],
      open_questions: [],
    });

    const loaded = loadProject(TEST_PROJECT_DIR)!;
    const locked = {
      ...loaded,
      field_metadata: {
        ...loaded.field_metadata,
        world_setting: { ...loaded.field_metadata!.world_setting!, locked: true },
      },
    };
    saveProject(TEST_PROJECT_DIR, locked);

    expect(() =>
      onFieldEdited(TEST_PROJECT_DIR, 'world_setting', {
        premise: '被锁定',
        era: '',
        locations: [],
        rules: [],
        power_structures: [],
        taboos: [],
        visual_language: [],
        tone_rules: [],
        open_questions: [],
      }),
    ).toThrow('locked');
  });
});
