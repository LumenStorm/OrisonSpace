import { describe, expect, it } from 'vitest';
import {
  agentContractSchema,
  agentPolicySchema,
  creativeConstraintsSchema,
  creativeRunRequestSchema,
  creativeRunContextSchema,
  workflowSyncEventSchema,
  fieldDependencyGraphSchema,
  assetPatchCandidateSchema,
  reusableAgentNodeContractSchema
} from '../src';

describe('agent-contract schemas', () => {
  it('creativeConstraintsSchema 使用默认值', () => {
    const c = creativeConstraintsSchema.parse({});
    expect(c.language).toBe('zh-CN');
  });

  it('creativeConstraintsSchema 校验完整约束', () => {
    const c = creativeConstraintsSchema.parse({
      language: 'en-US',
      contentRating: 'PG-13',
      episodeCount: 12,
      chapterCount: 24,
      targetLength: '200000字'
    });
    expect(c.episodeCount).toBe(12);
  });

  it('agentPolicySchema 使用默认值', () => {
    const p = agentPolicySchema.parse({});
    expect(p.outputJsonOnly).toBe(true);
    expect(p.defaultLanguage).toBe('zh-CN');
    expect(p.fieldNameCase).toBe('snake_case');
  });

  it('agentContractSchema 校验子 agent 契约', () => {
    const contract = agentContractSchema.parse({
      id: 'story-planner-agent',
      role: 'story planner',
      goal: 'generate or revise outline',
      owns: ['outline'],
      reads: ['creative_brief', 'world_setting', 'asset_cards', 'relationship_graph'],
      must: ['明确主题', '核心冲突', '主要转折'],
      mustNot: ['直接写章节正文'],
      outputSchemaName: 'outlineV2Schema',
      qualityGates: ['has_central_conflict', 'has_major_turning_points']
    });
    expect(contract.id).toBe('story-planner-agent');
    expect(contract.owns).toContain('outline');
    expect(contract.reads).toHaveLength(4);
  });

  it('fieldDependencyGraphSchema 校验依赖图', () => {
    const graph = fieldDependencyGraphSchema.parse({
      edges: [
        { upstream: 'asset_cards', downstream: 'world_setting' },
        { upstream: 'outline', downstream: 'episode_outlines' }
      ]
    });
    expect(graph.edges).toHaveLength(2);
  });

  it('workflowSyncEventSchema 校验同步事件', () => {
    const event = workflowSyncEventSchema.parse({
      id: 'evt_1',
      createdAt: '2026-04-25T10:00:00Z',
      source: 'agent',
      field: 'asset_cards',
      fromVersion: 1,
      toVersion: 2,
      reason: '新增角色卡',
      affectedFields: ['world_setting', 'outline', 'episode_outlines']
    });
    expect(event.field).toBe('asset_cards');
    expect(event.affectedFields).toHaveLength(3);
  });

  it('workflowSyncEventSchema 支持 entityId', () => {
    const event = workflowSyncEventSchema.parse({
      id: 'evt_2',
      createdAt: '2026-04-25T10:00:00Z',
      source: 'user',
      field: 'relationship_graph',
      entityId: 'edge_42',
      fromVersion: 0,
      toVersion: 1,
      reason: '用户编辑关系',
      affectedFields: ['outline']
    });
    expect(event.entityId).toBe('edge_42');
  });

  it('assetPatchCandidateSchema 校验资产候选补丁', () => {
    const patch = assetPatchCandidateSchema.parse({
      id: 'patch_1',
      action: 'add',
      targetType: 'asset_card',
      targetId: 'char_new',
      payload: { name: '新角色', type: 'character' },
      sourceRefs: ['draft-writer-agent:run_123'],
      autoApply: false,
      reason: '正文中发现新角色'
    });
    expect(patch.action).toBe('add');
    expect(patch.autoApply).toBe(false);
  });

  it('reusableAgentNodeContractSchema accepts workflow-agnostic node metadata', () => {
    const parsed = reusableAgentNodeContractSchema.parse({
      nodeId: 'story-sync-agent',
      displayName: 'Story Sync Agent',
      inputSchemaName: 'chapterContextAndCandidate',
      outputSchemaName: 'novelStorySyncPayload',
      requiredArtifactKeys: ['context.chapterContext', 'chapter.candidate'],
      producedArtifactKeys: ['story.sync'],
      sideEffects: ['persist_artifact'],
    });

    expect(parsed.nodeId).toBe('story-sync-agent');
    expect(parsed.requiredArtifactKeys).toContain('chapter.candidate');
    expect(parsed.producedArtifactKeys).toEqual(['story.sync']);
  });

  it('creativeRunRequestSchema 校验最小请求', () => {
    const req = creativeRunRequestSchema.parse({
      projectPath: 'I:/workspace/demo',
      requirement: '写一个悬疑故事'
    });
    expect(req.runIntent).toBe('create');
    expect(req.targetFields).toBeUndefined();
  });

  it('creativeRunRequestSchema 校验完整请求', () => {
    const req = creativeRunRequestSchema.parse({
      projectPath: 'I:/workspace/demo',
      requirement: '扩展第三集',
      runIntent: 'expand',
      targetFields: ['episode_outlines', 'growth_curve'],
      constraints: { language: 'zh-CN', episodeCount: 12 }
    });
    expect(req.runIntent).toBe('expand');
    expect(req.targetFields).toHaveLength(2);
  });

  it('creativeRunContextSchema 校验完整上下文', () => {
    const ctx = creativeRunContextSchema.parse({
      runId: 'run_abc',
      projectPath: 'I:/workspace/demo',
      requirement: '写一个悬疑故事',
      runIntent: 'create',
      targetFields: ['outline', 'world_setting'],
      projectDocument: null,
      projectDocumentStatus: 'missing',
      fieldVersions: {
        creative_brief: 0,
        world_setting: 0,
        outline: 0,
        episode_outlines: 0,
        growth_curve: 0,
        pacing_curve: 0,
        emotion_curve: 0,
        asset_cards: 0,
        relationship_graph: 0
      },
      dependencyGraph: { edges: [] },
      staleFields: [],
      syncEvents: [],
      constraints: { language: 'zh-CN' },
      agentPolicy: {}
    });
    expect(ctx.runId).toBe('run_abc');
    expect(ctx.projectDocumentStatus).toBe('missing');
    expect(ctx.agentPolicy.outputJsonOnly).toBe(true);
  });
});
