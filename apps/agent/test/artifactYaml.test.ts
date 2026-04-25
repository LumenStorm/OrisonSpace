import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { writeArtifactYaml, readArtifactYaml, buildContextPacket, writeContextPacketYaml } from '../src/engine/artifactYaml';
import type { AgentContract } from '@orison/shared-contracts';

const TEST_ROOT = path.join(process.cwd(), '.test-tmp-artifact-yaml');
const RUN_ID = 'run_test_001';

beforeEach(() => {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  mkdirSync(TEST_ROOT, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
});

describe('artifactYaml', () => {
  it('writeArtifactYaml 写入后 readArtifactYaml 能读回', () => {
    const artifact = { title: '暗城', central_conflict: '正义与秩序' };
    const meta = {
      schema_version: 1,
      field_version: 2,
      generated_by: 'story-planner-agent',
      source_refs: ['run_test_001:intake-agent']
    };

    const filePath = writeArtifactYaml(TEST_ROOT, RUN_ID, 'outline', artifact, meta);
    expect(existsSync(filePath)).toBe(true);

    const result = readArtifactYaml(TEST_ROOT, RUN_ID, 'outline');
    expect(result).not.toBeNull();
    expect(result!.meta.schema_version).toBe(1);
    expect(result!.meta.field_version).toBe(2);
    expect(result!.meta.generated_by).toBe('story-planner-agent');
    expect((result!.data as Record<string, unknown>).title).toBe('暗城');
  });

  it('readArtifactYaml 文件不存在时返回 null', () => {
    const result = readArtifactYaml(TEST_ROOT, RUN_ID, 'nonexistent');
    expect(result).toBeNull();
  });

  it('writeArtifactYaml 自动创建目录', () => {
    const artifact = { premise: '赛博朋克' };
    const meta = { schema_version: 1, field_version: 1, generated_by: 'asset-loader-agent', source_refs: [] };

    writeArtifactYaml(TEST_ROOT, 'run_new', 'world_setting', artifact, meta);
    const dir = path.join(TEST_ROOT, 'runs', 'run_new', 'artifacts');
    expect(existsSync(dir)).toBe(true);
  });
});

describe('buildContextPacket', () => {
  const storyPlannerContract: AgentContract = {
    id: 'story-planner-agent',
    role: 'story planner',
    goal: 'generate outline',
    owns: ['outline'],
    reads: ['creative_brief', 'world_setting', 'asset_cards', 'relationship_graph'],
    must: [],
    mustNot: [],
    outputSchemaName: 'outlineV2Schema',
    qualityGates: []
  };

  it('只包含 reads 中声明的字段', () => {
    const artifacts = {
      creative_brief: { genre: '悬疑' },
      world_setting: { premise: '暗城' },
      asset_cards: [{ id: 'c1', name: '李探长' }],
      relationship_graph: { nodes: [], edges: [] },
      outline: { title: '不应该出现' },
      episode_outlines: [{ id: 'ep1' }]
    };
    const versions = {
      creative_brief: 1, world_setting: 2, asset_cards: 3,
      relationship_graph: 1, outline: 0, episode_outlines: 0,
      growth_curve: 0, pacing_curve: 0, emotion_curve: 0
    };

    const packet = buildContextPacket(storyPlannerContract, artifacts, versions, 'run_1');

    expect(packet.run_id).toBe('run_1');
    expect(packet.node_id).toBe('story-planner-agent');

    const fields = packet.fields as Record<string, unknown>;
    expect(fields.creative_brief).toBeDefined();
    expect(fields.world_setting).toBeDefined();
    expect(fields.asset_cards).toBeDefined();
    expect(fields.relationship_graph).toBeDefined();
    // 不在 reads 中的字段不应出现
    expect(fields.outline).toBeUndefined();
    expect(fields.episode_outlines).toBeUndefined();

    const fv = packet.field_versions as Record<string, number>;
    expect(fv.creative_brief).toBe(1);
    expect(fv.world_setting).toBe(2);
  });

  it('artifact 缺失时 fields 中不包含该字段', () => {
    const artifacts = { creative_brief: { genre: '悬疑' } };
    const versions = {
      creative_brief: 1, world_setting: 0, asset_cards: 0,
      relationship_graph: 0, outline: 0, episode_outlines: 0,
      growth_curve: 0, pacing_curve: 0, emotion_curve: 0
    };

    const packet = buildContextPacket(storyPlannerContract, artifacts, versions, 'run_2');
    const fields = packet.fields as Record<string, unknown>;
    expect(fields.creative_brief).toBeDefined();
    expect(fields.world_setting).toBeUndefined();
  });
});

describe('writeContextPacketYaml', () => {
  it('写入 context packet YAML', () => {
    const packet = { run_id: 'run_1', node_id: 'story-planner-agent', fields: {} };
    const filePath = writeContextPacketYaml(TEST_ROOT, RUN_ID, 'story-planner-agent', packet);
    expect(existsSync(filePath)).toBe(true);
  });
});
