import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRunService } from '../src/engine/runService';

/**
 * 最小 creative run 集成测试。
 * 验证 startCreative 使用扩展 registry（含 curve-planner / episode-planner），
 * 产出 world_setting、outline、episode_outlines、asset_cards 四个核心字段。
 */

const MOCK_BY_NODE = JSON.stringify({
  __mock_by_node__: {
    'intake-agent': {
      genre: '悬疑',
      theme: '救赎',
      tone: 'dark',
      audience: '成人',
      length: '中篇',
      taboos: [],
      userConstraints: [],
      rawRequirement: '写一个都市悬疑故事'
    },
    'asset-loader-agent': {
      world_setting: {
        premise: '永夜都市',
        era: '近未来',
        locations: [{ id: 'loc_1', name: '暗巷', description: '城市边缘' }],
        rules: ['夜永不结束'],
        power_structures: [],
        taboos: [],
        visual_language: ['noir'],
        tone_rules: ['保持压抑'],
        open_questions: []
      },
      asset_cards: [
        { id: 'c1', type: 'character', name: '侦探', summary: '孤独的调查者', tags: ['主角'], relationships: [], sourceRefs: [], status: 'active', locked: false },
        { id: 'loc_1', type: 'location', name: '暗巷', summary: '城市边缘地带', tags: [], relationships: [], sourceRefs: [], status: 'active', locked: false }
      ],
      relationship_graph: {
        nodes: [
          { id: 'n1', assetCardId: 'c1', label: '侦探', type: 'character', locked: false }
        ],
        edges: [],
        version: 0,
        updatedBy: 'agent'
      }
    },
    'story-planner-agent': {
      title: '暗城',
      logline: '一个侦探在永夜都市追查失踪案',
      theme: '救赎',
      genre: '悬疑',
      central_conflict: '真相与遗忘的对抗',
      acts: [
        { id: 'act_1', title: '入局', goal: '引入主角', conflict: '失踪案', turning_point: '发现线索' }
      ],
      major_turning_points: ['发现线索'],
      ending_direction: '真相大白',
      constraints: []
    },
    'curve-planner-agent': {
      growth_curve: {
        character_id: 'c1',
        start_state: '迷茫',
        wound_or_lack: '失去搭档',
        desire: '找到真相',
        need: '接受过去',
        turning_points: [{ turning_point: '发现关键证据', linked_episode_ids: ['ep_1'] }],
        regressions: [],
        end_state: '释然',
        linked_episode_ids: ['ep_1']
      },
      pacing_curve: {
        unit: 'episode',
        points: [{ refId: 'ep_1', intensity: 6 }],
        target_shape: 'rising',
        risks: []
      },
      emotion_curve: {
        unit: 'episode',
        points: [{ refId: 'ep_1', primaryEmotion: '紧张', valence: -0.3, arousal: 0.7 }],
        emotional_promises: ['揭示真相时的释然'],
        catharsis_points: ['结局']
      }
    },
    'episode-planner-agent': [
      {
        id: 'ep_1',
        index: 0,
        title: '暗巷追踪',
        purpose: '引入主线',
        summary: '侦探接到失踪案',
        core_event: '发现第一条线索',
        character_progressions: [{ characterId: 'c1', from: '迷茫', to: '警觉' }],
        emotional_beats: ['紧张', '好奇'],
        pacing_beats: ['缓起', '渐强'],
        foreshadowing: ['神秘电话'],
        payoffs: [],
        hook: '线索指向意想不到的人',
        dependsOn: [],
        status: 'planned'
      }
    ],
    'chapter-task-agent': [
      { id: 'ch1', title: '暗巷追踪', goal: '引入', scenes: ['s1'], characters: ['侦探'], wordTarget: 3000 }
    ],
    'draft-writer-agent': {
      title: '暗巷追踪', text: '夜色如墨...', wordCount: 3000, chapterId: 'ch1'
    },
    'continuity-memory-agent': {
      characters: [{ name: '侦探', status: 'active', lastAction: '进入暗巷' }],
      timeline: ['永夜第一日'], foreshadowing: ['神秘电话'], toneRules: ['noir']
    },
    'multi-review-agent': {
      verdict: 'pass', summary: '质量达标',
      dimensions: [{ name: 'structure', score: 8, comment: '结构完整' }], reasons: []
    }
  }
});

describe('creative run 最小产出验证', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_RESPONSES_MOCK_JSON = MOCK_BY_NODE;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RESPONSES_MOCK_JSON;
  });

  it('最小 run 产出 world_setting、outline、episode_outlines、asset_cards', { timeout: 60000 }, async () => {
    const service = createRunService();
    const run = await service.startCreative({
      projectPath: 'I:/workspace/demo',
      requirement: '写一个都市悬疑故事',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    expect(run.status).toBe('delivered');

    // 验证扩展节点都已完成
    expect(run.completedNodes).toContain('curve-planner-agent');
    expect(run.completedNodes).toContain('episode-planner-agent');

    // 验证核心字段产出
    const a = run.artifacts;

    // world_setting + asset_cards + relationship_graph 来自 asset-loader
    const assetOutput = a['assets.projectContext'] as Record<string, unknown>;
    expect(assetOutput).toBeDefined();
    expect(assetOutput.world_setting).toBeDefined();
    expect(assetOutput.asset_cards).toBeDefined();
    expect(Array.isArray(assetOutput.asset_cards)).toBe(true);
    expect(assetOutput.relationship_graph).toBeDefined();

    // outline 来自 story-planner
    const outline = a['planning.storyPlan'] as Record<string, unknown>;
    expect(outline).toBeDefined();
    expect(outline.title).toBe('暗城');
    expect(outline.acts).toBeDefined();

    // episode_outlines 来自 episode-planner
    const episodes = a['episode_outlines'] as Array<Record<string, unknown>>;
    expect(episodes).toBeDefined();
    expect(Array.isArray(episodes)).toBe(true);
    expect(episodes.length).toBeGreaterThan(0);
    expect(episodes[0].id).toBe('ep_1');
    expect(episodes[0].core_event).toBeDefined();

    // curves 来自 curve-planner
    const curves = a['curves'] as Record<string, unknown>;
    expect(curves).toBeDefined();
    expect(curves.growth_curve).toBeDefined();
    expect(curves.pacing_curve).toBeDefined();
    expect(curves.emotion_curve).toBeDefined();
  });
});
