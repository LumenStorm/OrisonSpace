import { describe, expect, it } from 'vitest';
import {
  creativeBriefSchema,
  worldSettingSchema,
  outlineV2Schema,
  episodeOutlineSchema,
  episodeOutlinesSchema,
  growthCurveSchema,
  pacingCurveSchema,
  emotionCurveSchema,
  assetCardSchema,
  assetCardsSchema,
  relationshipGraphSchema,
  foreshadowRegistrySchema,
  fieldMetadataSchema,
  creativeFieldKeys,
  creativeFieldKeySchema
} from '../src';

describe('creative-fields schemas', () => {
  it('creativeFieldKeys 覆盖 10 个核心字段', () => {
    expect(creativeFieldKeys).toHaveLength(10);
    expect(creativeFieldKeys).toContain('world_setting');
    expect(creativeFieldKeys).toContain('asset_cards');
    expect(creativeFieldKeys).toContain('relationship_graph');
    expect(creativeFieldKeys).toContain('episode_outlines');
    expect(creativeFieldKeys).toContain('foreshadow_registry');
  });

  it('creativeFieldKeySchema 校验合法值', () => {
    expect(creativeFieldKeySchema.parse('outline')).toBe('outline');
    expect(() => creativeFieldKeySchema.parse('invalid')).toThrow();
  });

  it('fieldMetadataSchema 校验完整元信息', () => {
    const meta = fieldMetadataSchema.parse({
      version: 3,
      source: 'agent',
      locked: true,
      dependsOn: [{ field: 'outline', version: 2 }],
      stale: false,
      lastSyncedAt: '2026-04-25T00:00:00Z'
    });
    expect(meta.version).toBe(3);
    expect(meta.dependsOn[0].field).toBe('outline');
  });

  it('fieldMetadataSchema 使用默认值', () => {
    const meta = fieldMetadataSchema.parse({ version: 0, source: 'user' });
    expect(meta.locked).toBe(false);
    expect(meta.stale).toBe(false);
    expect(meta.dependsOn).toEqual([]);
  });

  it('creativeBriefSchema 校验创作 brief', () => {
    const brief = creativeBriefSchema.parse({
      genre: '悬疑',
      theme: '救赎',
      tone: '暗黑',
      rawRequirement: '写一个关于侦探的故事'
    });
    expect(brief.rawRequirement).toBe('写一个关于侦探的故事');
    expect(brief.taboos).toEqual([]);
  });

  it('worldSettingSchema 校验世设', () => {
    const ws = worldSettingSchema.parse({
      premise: '近未来赛博朋克城市',
      era: '2077',
      rules: ['AI 不能伤害人类'],
      taboos: ['不涉及真实政治']
    });
    expect(ws.premise).toBe('近未来赛博朋克城市');
    expect(ws.rules).toHaveLength(1);
  });

  it('outlineV2Schema 校验扩展大纲', () => {
    const outline = outlineV2Schema.parse({
      title: '暗城',
      logline: '一个侦探在暗城追查真相',
      central_conflict: '正义与秩序的冲突',
      acts: [{ id: 'act_1', title: '序幕', goal: '引入世界', conflict: '初次遭遇' }],
      major_turning_points: ['发现真相', '背叛'],
      ending_direction: '开放式结局'
    });
    expect(outline.central_conflict).toBe('正义与秩序的冲突');
    expect(outline.major_turning_points).toHaveLength(2);
  });

  it('episodeOutlineSchema 校验集纲', () => {
    const ep = episodeOutlineSchema.parse({
      id: 'ep_1',
      index: 0,
      title: '第一集：暗夜降临',
      purpose: '建立世界观',
      core_event: '主角到达暗城',
      character_progressions: [{ characterId: 'char_1', from: '迷茫', to: '决心' }],
      emotional_beats: ['紧张', '好奇'],
      hook: '神秘信件'
    });
    expect(ep.status).toBe('planned');
    expect(ep.character_progressions).toHaveLength(1);
  });

  it('episodeOutlinesSchema 校验集纲数组', () => {
    const eps = episodeOutlinesSchema.parse([
      { id: 'ep_1', index: 0, title: '第一集' },
      { id: 'ep_2', index: 1, title: '第二集' }
    ]);
    expect(eps).toHaveLength(2);
  });

  it('growthCurveSchema 校验成长曲线', () => {
    const curve = growthCurveSchema.parse({
      character_id: 'char_1',
      start_state: '天真少年',
      wound_or_lack: '失去父亲',
      desire: '复仇',
      need: '放下仇恨',
      turning_points: [{ turning_point: '遇到导师', linked_episode_ids: ['ep_2'] }],
      end_state: '成熟的守护者'
    });
    expect(curve.character_id).toBe('char_1');
    expect(curve.turning_points).toHaveLength(1);
  });

  it('pacingCurveSchema 校验节奏曲线', () => {
    const curve = pacingCurveSchema.parse({
      unit: 'episode',
      points: [
        { refId: 'ep_1', intensity: 3 },
        { refId: 'ep_2', intensity: 7, actionLevel: 8 }
      ],
      target_shape: 'rising',
      risks: ['中段节奏拖沓']
    });
    expect(curve.points).toHaveLength(2);
    expect(curve.target_shape).toBe('rising');
  });

  it('emotionCurveSchema 校验情感曲线', () => {
    const curve = emotionCurveSchema.parse({
      unit: 'act',
      points: [
        { refId: 'act_1', primaryEmotion: '好奇', valence: 0.3, arousal: 0.5 },
        { refId: 'act_2', primaryEmotion: '恐惧', valence: -0.7, arousal: 0.9 }
      ],
      emotional_promises: ['正义终将到来'],
      catharsis_points: ['最终对决']
    });
    expect(curve.points).toHaveLength(2);
    expect(curve.catharsis_points).toHaveLength(1);
  });

  it('assetCardSchema 校验资产卡', () => {
    const card = assetCardSchema.parse({
      id: 'char_main',
      type: 'character',
      name: '李探长',
      summary: '暗城资深侦探',
      tags: ['主角', '侦探'],
      relationships: [{ targetId: 'char_villain', relationType: 'rivalry' }],
      firstAppearance: 'ep_1',
      status: 'active'
    });
    expect(card.type).toBe('character');
    expect(card.relationships).toHaveLength(1);
  });

  it('assetCardsSchema 校验资产卡数组', () => {
    const cards = assetCardsSchema.parse([
      { id: 'char_1', type: 'character', name: '角色A' },
      { id: 'loc_1', type: 'location', name: '暗城广场' }
    ]);
    expect(cards).toHaveLength(2);
  });

  it('relationshipGraphSchema 校验人物关系网', () => {
    const graph = relationshipGraphSchema.parse({
      nodes: [
        { id: 'n1', assetCardId: 'char_1', label: '李探长', type: 'character' },
        { id: 'n2', assetCardId: 'char_2', label: '王局长', type: 'character' }
      ],
      edges: [
        {
          id: 'e1', from: 'n1', to: 'n2',
          relationType: 'alliance', label: '上下级',
          strength: 7, polarity: 'positive', visibility: 'public'
        }
      ],
      version: 1,
      updatedBy: 'agent'
    });
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges[0].relationType).toBe('alliance');
  });

  it('relationshipGraphSchema 使用默认值', () => {
    const graph = relationshipGraphSchema.parse({});
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.version).toBe(0);
  });
  it('foreshadowRegistrySchema tracks planting, payoff, urgency and context flags', () => {
    const registry = foreshadowRegistrySchema.parse({
      items: [
        {
          id: 'fs_red_key',
          title: 'red key',
          content: 'A red key appears before the locked tower is introduced.',
          plant_ref: 'ep_1',
          plant_index: 1,
          target_resolve_ref: 'ep_5',
          target_resolve_index: 5,
          status: 'planted',
          category: 'item',
          related_asset_ids: ['prop_red_key']
        }
      ]
    });

    expect(registry.items[0].status).toBe('planted');
    expect(registry.items[0].importance).toBe(0.5);
    expect(registry.items[0].auto_remind).toBe(true);
    expect(registry.items[0].include_in_context).toBe(true);
    expect(registry.version).toBe(0);
  });
});
