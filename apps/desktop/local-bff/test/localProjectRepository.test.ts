import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  applyPatchOperations,
  createEmptyProjectDocument,
  saveProject,
  loadProject,
  applyFieldPatches,
  deleteAssetArchive,
} from '../sync/localProjectRepository';
import type { ProjectFieldPatch } from '@orison/shared-contracts';

const TEST_PROJECT_DIR = path.join(process.cwd(), 'test-tmp-local-project');

describe('local project repository helpers', () => {
  afterEach(() => {
    if (existsSync(TEST_PROJECT_DIR)) {
      rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  it('creates an empty local project document with outline and storyboard roots', () => {
    const project = createEmptyProjectDocument('Orison Demo');

    expect(project.meta.name).toBe('Orison Demo');
    expect(project.meta.type).toBe('novel');
    expect(project.outline.acts).toEqual([]);
    expect(project.storyboard.shots).toEqual([]);
  });

  it('applies a replace patch to the first outline act summary', () => {
    const project = createEmptyProjectDocument('Demo');
    const withAct = {
      ...project,
      outline: {
        ...project.outline,
        acts: [{ id: 'act_1', title: 'Arrival', summary: 'Old value' }],
      },
    };

    const updated = applyPatchOperations(withAct, [
      {
        op: 'replace',
        path: 'outline.acts[0].summary',
        value: 'New value',
      },
    ]);

    expect(updated.outline.acts[0].summary).toBe('New value');
  });

  it('saveProject / loadProject round-trips a basic project', () => {
    const project = createEmptyProjectDocument('Round Trip Test');
    saveProject(TEST_PROJECT_DIR, project);

    const loaded = loadProject(TEST_PROJECT_DIR);
    expect(loaded).not.toBeNull();
    expect(loaded!.meta.name).toBe('Round Trip Test');
    expect(loaded!.meta.type).toBe('novel');
    expect(loaded!.outline.acts).toEqual([]);
  });

  it('loadProject returns null for a missing project path', () => {
    const loaded = loadProject(path.join(TEST_PROJECT_DIR, 'nonexistent'));
    expect(loaded).toBeNull();
  });

  it('saveProject persists creative fields and loadProject reads them back', () => {
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
        open_questions: [],
      },
      asset_cards: [
        {
          id: 'c1',
          type: 'character' as const,
          name: '侦探',
          summary: '孤独调查员',
          tags: [],
          relationships: [],
          sourceRefs: [],
          status: 'active' as const,
          locked: false,
        },
      ],
    };

    saveProject(TEST_PROJECT_DIR, withFields as any);
    const loaded = loadProject(TEST_PROJECT_DIR);

    expect(loaded!.world_setting).toBeDefined();
    expect(loaded!.world_setting!.premise).toBe('永夜都市');
    expect(loaded!.asset_cards).toBeDefined();
    expect(loaded!.asset_cards!.length).toBe(1);
    expect(loaded!.asset_cards![0].name).toBe('侦探');
  });

  it('saveProject writes supported archive cards into YAML dossier files and reloads them', () => {
    const project = createEmptyProjectDocument('Archive Sync Test');
    const withArchiveCards = {
      ...project,
      asset_cards: [
        {
          id: 'char_lin_qi',
          type: 'character' as const,
          name: '林七',
          summary: '冷静克制的调查员',
          tags: ['主角'],
          relationships: [],
          sourceRefs: ['assets/characters/lin-qi.yaml'],
          status: 'active' as const,
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
                prompt: 'detective portrait',
              },
            ],
          },
          details: {
            profile: {
              role: '主角',
            },
            persona: {
              personality: '冷静',
            },
          },
        },
      ],
    };

    saveProject(TEST_PROJECT_DIR, withArchiveCards as any);

    const archivePath = path.join(TEST_PROJECT_DIR, 'assets', 'characters', 'lin-qi.yaml');
    expect(existsSync(archivePath)).toBe(true);
    expect(readFileSync(archivePath, 'utf8')).toContain('name: 林七');

    const loaded = loadProject(TEST_PROJECT_DIR);
    expect(loaded!.asset_cards?.[0].archive?.path).toBe('assets/characters/lin-qi.yaml');
    expect(loaded!.asset_cards?.[0].visuals?.gallery[0].kind).toBe('primary');
  });

  it('rejects archive dossier paths outside the supported project archive directories', () => {
    const project = createEmptyProjectDocument('Archive Path Guard Test');
    const withEscapingArchive = {
      ...project,
      asset_cards: [
        {
          id: 'char_escape',
          type: 'character' as const,
          name: 'Escape',
          tags: [],
          relationships: [],
          sourceRefs: [],
          status: 'draft' as const,
          archive: {
            path: '../outside.yaml',
            slug: 'escape',
            schemaVersion: 1,
          },
        },
      ],
    };

    expect(() => saveProject(TEST_PROJECT_DIR, withEscapingArchive as any)).toThrow(/Invalid archive path/);
    expect(existsSync(path.join(TEST_PROJECT_DIR, '..', 'outside.yaml'))).toBe(false);
  });

  it('deletes a supported archive card, its yaml dossier, and attached images', () => {
    const project = createEmptyProjectDocument('Delete Archive Test');
    const withArchiveCards = {
      ...project,
      asset_cards: [
        {
          id: 'char_lin_qi',
          type: 'character' as const,
          name: 'Lin Qi',
          summary: 'Calm detective',
          tags: ['lead'],
          relationships: [],
          sourceRefs: ['assets/characters/lin-qi.yaml'],
          status: 'active' as const,
          archive: {
            path: 'assets/characters/lin-qi.yaml',
            slug: 'lin-qi',
            schemaVersion: 1,
          },
          visuals: {
            primaryImage: 'assets/images/lin-qi-main.png',
            gallery: [
              { id: 'img_main', path: 'assets/images/lin-qi-main.png', kind: 'primary' },
              { id: 'img_ref', path: 'assets/images/lin-qi-ref.png', kind: 'scene_reference' },
            ],
          },
          details: {
            profile: {
              role: 'lead',
            },
          },
        },
      ],
    };

    saveProject(TEST_PROJECT_DIR, withArchiveCards as any);
    mkdirSync(path.join(TEST_PROJECT_DIR, 'assets', 'images'), { recursive: true });
    writeFileSync(path.join(TEST_PROJECT_DIR, 'assets', 'images', 'lin-qi-main.png'), 'main');
    writeFileSync(path.join(TEST_PROJECT_DIR, 'assets', 'images', 'lin-qi-ref.png'), 'ref');

    const updated = deleteAssetArchive(TEST_PROJECT_DIR, 'char_lin_qi');

    expect(updated.asset_cards ?? []).toEqual([]);
    expect(existsSync(path.join(TEST_PROJECT_DIR, 'assets', 'characters', 'lin-qi.yaml'))).toBe(false);
    expect(existsSync(path.join(TEST_PROJECT_DIR, 'assets', 'images', 'lin-qi-main.png'))).toBe(false);
    expect(existsSync(path.join(TEST_PROJECT_DIR, 'assets', 'images', 'lin-qi-ref.png'))).toBe(false);
  });

  it('ignores missing image files when deleting a supported archive', () => {
    const project = createEmptyProjectDocument('Delete Missing Image Test');
    const withArchiveCards = {
      ...project,
      asset_cards: [
        {
          id: 'prop_key',
          type: 'prop' as const,
          name: 'Copper Key',
          summary: 'Critical prop',
          tags: [],
          relationships: [],
          sourceRefs: ['assets/props/copper-key.yaml'],
          status: 'active' as const,
          archive: {
            path: 'assets/props/copper-key.yaml',
            slug: 'copper-key',
            schemaVersion: 1,
          },
          visuals: {
            primaryImage: 'assets/images/missing.png',
            gallery: [{ id: 'img_missing', path: 'assets/images/missing.png', kind: 'primary' }],
          },
        },
      ],
    };

    saveProject(TEST_PROJECT_DIR, withArchiveCards as any);

    expect(() => deleteAssetArchive(TEST_PROJECT_DIR, 'prop_key')).not.toThrow();
    expect(existsSync(path.join(TEST_PROJECT_DIR, 'assets', 'props', 'copper-key.yaml'))).toBe(false);
  });

  it('applyFieldPatches updates fields and field metadata', () => {
    const project = createEmptyProjectDocument('Patch Test');
    saveProject(TEST_PROJECT_DIR, project);

    const fieldPatch: ProjectFieldPatch = {
      runId: 'run_test_123',
      createdAt: new Date().toISOString(),
      patches: [
        {
          field: 'world_setting',
          action: 'set',
          data: {
            premise: '星海城',
            era: '2077',
            locations: [],
            rules: [],
            power_structures: [],
            taboos: [],
            visual_language: [],
            tone_rules: [],
            open_questions: [],
          },
          fieldVersion: 1,
          generatedBy: 'asset-loader-agent',
        },
        {
          field: 'asset_cards',
          action: 'set',
          data: [
            {
              id: 'c1',
              type: 'character',
              name: 'V',
              summary: '迷雾',
              tags: [],
              relationships: [],
              sourceRefs: [],
              status: 'active',
              locked: false,
            },
          ],
          fieldVersion: 1,
          generatedBy: 'asset-loader-agent',
        },
      ],
    };

    const updated = applyFieldPatches(TEST_PROJECT_DIR, fieldPatch);

    expect(updated.world_setting).toBeDefined();
    expect(updated.world_setting!.premise).toBe('星海城');
    expect(updated.asset_cards).toBeDefined();
    expect(updated.asset_cards!.length).toBe(1);
    expect(updated.field_metadata).toBeDefined();
    expect(updated.field_metadata!.world_setting).toBeDefined();
    expect(updated.field_metadata!.world_setting!.version).toBe(1);
    expect(updated.field_metadata!.world_setting!.source).toBe('agent');
    expect(updated.meta.version).toBe(2);
  });

  it('applyFieldPatches supports chapter_candidate patches', () => {
    const project = createEmptyProjectDocument('Chapter Candidate Patch');
    const withNovel = {
      ...project,
      novel: {
        chapters: [
          {
            id: 'ch_001',
            title: '旧标题',
            sort_order: 0,
            content_file: 'chapters/ch_001.md',
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
              content: '新章节正文内容。',
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

    expect(updated.novel).toBeDefined();
    expect(updated.novel!.chapters[0].title).toBe('第1章 新标题');
    expect(updated.novel!.chapters[0].summary).toBe('新摘要。');
    expect(updated.novel!.chapters[0].word_count).toBe(42);
    expect(updated.novel!.chapters[0].status).toBe('draft');
    expect(updated.meta.version).toBe(2);
  });

  it('legacy assets.characters loads as derived asset_cards', () => {
    const project = createEmptyProjectDocument('Legacy Test');
    const withOldAssets = {
      ...project,
      assets: {
        characters: [{ id: 'char_1', name: '林七', appearance: '高大', personality: '冷静' }],
        locations: [{ id: 'loc_1', name: '办公室', description: '现代空间' }],
      },
    };

    saveProject(TEST_PROJECT_DIR, withOldAssets as any);
    const loaded = loadProject(TEST_PROJECT_DIR);

    expect(loaded!.assets).toBeDefined();
    expect(loaded!.asset_cards).toBeDefined();
    expect(loaded!.asset_cards!.length).toBe(1);
    expect(loaded!.asset_cards![0].name).toBe('林七');
    expect(loaded!.asset_cards![0].type).toBe('character');
  });
});
