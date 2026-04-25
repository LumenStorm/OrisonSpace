import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createRunService } from '../src/engine/runService';
import { readArtifactYaml } from '../src/engine/artifactYaml';
import { buildCreativeDelivery } from '../src/engine/deliveryService';
import { buildCreativeRunContext } from '../src/engine/contextBuilder';
import { projectFieldPatchSchema } from '@orison/shared-contracts';

const MOCK_BY_NODE = JSON.stringify({
  __mock_by_node__: {
    'intake-agent': {
      genre: '悬疑', theme: '救赎', tone: 'dark', audience: '成人',
      length: '中篇', taboos: [], userConstraints: [], rawRequirement: '写一个都市悬疑故事'
    },
    'asset-loader-agent': {
      world_setting: { premise: '永夜都市', era: '近未来', locations: [], rules: [], power_structures: [], taboos: [], visual_language: [], tone_rules: [], open_questions: [] },
      asset_cards: [{ id: 'c1', type: 'character', name: '侦探', summary: '孤独调查者', tags: [], relationships: [], sourceRefs: [], status: 'active', locked: false }],
      relationship_graph: { nodes: [{ id: 'n1', assetCardId: 'c1', label: '侦探', type: 'character', locked: false }], edges: [], version: 0, updatedBy: 'agent' }
    },
    'story-planner-agent': {
      title: '暗城', logline: '侦探追查失踪案', theme: '救赎', genre: '悬疑',
      central_conflict: '真相与遗忘', acts: [{ id: 'act_1', title: '入局', goal: '引入', conflict: '失踪', turning_point: '线索' }],
      major_turning_points: ['线索'], ending_direction: '真相大白', constraints: []
    },
    'curve-planner-agent': {
      growth_curve: { character_id: 'c1', start_state: '迷茫', wound_or_lack: '失去搭档', desire: '真相', need: '接受', turning_points: [], regressions: [], end_state: '释然', linked_episode_ids: ['ep_1'] },
      pacing_curve: { unit: 'episode', points: [{ refId: 'ep_1', intensity: 6 }], target_shape: 'rising', risks: [] },
      emotion_curve: { unit: 'episode', points: [{ refId: 'ep_1', primaryEmotion: '紧张', valence: -0.3, arousal: 0.7 }], emotional_promises: [], catharsis_points: [] }
    },
    'episode-planner-agent': [{ id: 'ep_1', index: 0, title: '暗巷', purpose: '引入', summary: '接案', core_event: '线索', character_progressions: [], emotional_beats: [], pacing_beats: [], foreshadowing: [], payoffs: [], hook: '悬念', dependsOn: [], status: 'planned' }],
    'chapter-task-agent': [{ id: 'ch1', title: '暗巷', goal: '引入', scenes: ['s1'], characters: ['侦探'], wordTarget: 3000 }],
    'draft-writer-agent': { title: '暗巷', text: '夜色如墨...', wordCount: 3000, chapterId: 'ch1' },
    'continuity-memory-agent': { characters: [{ name: '侦探', status: 'active', lastAction: '进入暗巷' }], timeline: ['永夜'], foreshadowing: [], toneRules: ['noir'] },
    'multi-review-agent': { verdict: 'pass', summary: '达标', dimensions: [{ name: 'structure', score: 8, comment: '完整' }], reasons: [] }
  }
});

const TEST_CONFIG_ROOT = path.join(process.cwd(), 'test-tmp-artifact-persistence');

describe('artifact persistence 集成测试', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_RESPONSES_MOCK_JSON = MOCK_BY_NODE;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RESPONSES_MOCK_JSON;
    if (existsSync(TEST_CONFIG_ROOT)) {
      rmSync(TEST_CONFIG_ROOT, { recursive: true, force: true });
    }
  });

  it('creative run 落盘 artifact YAML 文件', { timeout: 60000 }, async () => {
    const service = createRunService();
    const run = await service.startCreative({
      projectPath: TEST_CONFIG_ROOT,
      requirement: '写一个都市悬疑故事',
      configRoot: TEST_CONFIG_ROOT
    });

    expect(run.status).toBe('delivered');

    // 验证 artifacts 目录存在
    const artifactDir = path.join(TEST_CONFIG_ROOT, 'runs', run.runId, 'artifacts');
    expect(existsSync(artifactDir)).toBe(true);

    // 验证关键产物 YAML 可读
    const storyPlan = readArtifactYaml(TEST_CONFIG_ROOT, run.runId, 'planning.storyPlan');
    expect(storyPlan).not.toBeNull();
    expect((storyPlan!.data as any).title).toBe('暗城');

    const curves = readArtifactYaml(TEST_CONFIG_ROOT, run.runId, 'curves');
    expect(curves).not.toBeNull();
    expect((curves!.data as any).growth_curve).toBeDefined();

    const episodes = readArtifactYaml(TEST_CONFIG_ROOT, run.runId, 'episode_outlines');
    expect(episodes).not.toBeNull();
  });

  it('creative run 落盘 context-packet YAML 文件', { timeout: 60000 }, async () => {
    const service = createRunService();
    const run = await service.startCreative({
      projectPath: TEST_CONFIG_ROOT,
      requirement: '写一个都市悬疑故事',
      configRoot: TEST_CONFIG_ROOT
    });

    expect(run.status).toBe('delivered');

    // 验证 context-packets 目录存在
    const packetDir = path.join(TEST_CONFIG_ROOT, 'runs', run.runId, 'context-packets');
    expect(existsSync(packetDir)).toBe(true);
  });

  it('buildCreativeDelivery 生成有效的 ProjectFieldPatch', { timeout: 60000 }, async () => {
    const service = createRunService();
    const request = {
      projectPath: TEST_CONFIG_ROOT,
      requirement: '写一个都市悬疑故事',
      configRoot: TEST_CONFIG_ROOT
    };
    const run = await service.startCreative(request);
    const context = buildCreativeRunContext(request);

    const patch = buildCreativeDelivery(run, context);

    // schema 校验
    const validated = projectFieldPatchSchema.parse(patch);
    expect(validated.runId).toBe(run.runId);
    expect(validated.patches.length).toBeGreaterThan(0);

    // 验证包含关键字段
    const fields = validated.patches.map((p) => p.field);
    expect(fields).toContain('world_setting');
    expect(fields).toContain('outline');
    expect(fields).toContain('asset_cards');
    expect(fields).toContain('episode_outlines');
    expect(fields).toContain('growth_curve');
    expect(fields).toContain('pacing_curve');
    expect(fields).toContain('emotion_curve');
  });
});
