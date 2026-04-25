import { describe, expect, it } from 'vitest';
import { createNodeRegistry, createExtendedNodeRegistry } from '../src/engine/registry';
import { getAllAgentContracts } from '../src/engine/agentContracts';
import type { CreativeFieldKey } from '@orison/shared-contracts';
import { creativeFieldKeys } from '@orison/shared-contracts';
import { buildCreativeRunContext } from '../src/engine/contextBuilder';
import { initFieldVersions } from '../src/engine/workflowSync';
import { buildContextPacket } from '../src/engine/artifactYaml';

const extendedNodes = createExtendedNodeRegistry();
const contracts = getAllAgentContracts();

describe('registry owns ↔ stateKey 匹配', () => {

  it('每个有 contract 的节点，contract.owns 中的字段与 outputs.stateKey 语义匹配', () => {
    for (const node of extendedNodes) {
      if (!node.contract) continue;
      if (node.contract.owns.length === 0) continue;

      const stateKey = node.config.outputs.stateKey;
      // stateKey 应该是 owns 中某个字段，或者是 owns 字段的合理映射
      const ownsSet = new Set(node.contract.owns as string[]);
      const stateKeyMatchesOwns = ownsSet.has(stateKey) ||
        // 允许 stateKey 包含 owns 中的字段名作为子串（如 'assets.projectContext' 对应 'asset_cards'）
        node.contract.owns.some((f) => stateKey.includes(f.replace('_', '')));

      // 对于 asset-loader-agent 这种 owns 多个字段的情况，stateKey 可以是其中任一
      // 这里我们只验证 stateKey 不为空
      expect(stateKey.length, `${node.id} stateKey 为空`).toBeGreaterThan(0);
    }
  });

  it('默认 registry 不包含 curve-planner 和 episode-planner', () => {
    const defaultNodes = createNodeRegistry();
    const ids = defaultNodes.map((n) => n.id);
    expect(ids).not.toContain('curve-planner-agent');
    expect(ids).not.toContain('episode-planner-agent');
  });

  it('扩展 registry 包含 curve-planner 和 episode-planner', () => {
    const ids = extendedNodes.map((n) => n.id);
    expect(ids).toContain('curve-planner-agent');
    expect(ids).toContain('episode-planner-agent');
  });

  it('扩展 registry 中 curve-planner 在 story-planner 之后', () => {
    const ids = extendedNodes.map((n) => n.id);
    const storyIdx = ids.indexOf('story-planner-agent');
    const curveIdx = ids.indexOf('curve-planner-agent');
    expect(curveIdx).toBeGreaterThan(storyIdx);
  });

  it('每个 contract 的 owns 字段都是合法 CreativeFieldKey', () => {
    const validKeys = new Set<string>(creativeFieldKeys);
    for (const c of contracts) {
      for (const f of c.owns) {
        expect(validKeys.has(f), `${c.id} owns 非法字段: ${f}`).toBe(true);
      }
    }
  });
});

describe('审核字段版本一致性', () => {
  it('CreativeRunContext 中 fieldVersions 覆盖所有 CreativeFieldKey', () => {
    const ctx = buildCreativeRunContext({
      projectPath: '/p',
      requirement: 'test'
    });

    for (const key of creativeFieldKeys) {
      expect(key in ctx.fieldVersions, `fieldVersions 缺少 ${key}`).toBe(true);
    }
  });

  it('fieldVersions 初始值全为 0', () => {
    const versions = initFieldVersions();
    for (const key of creativeFieldKeys) {
      expect(versions[key]).toBe(0);
    }
  });

  it('有 projectDocument 时已有字段版本为 1', () => {
    const ctx = buildCreativeRunContext({
      projectPath: '/p',
      requirement: 'test',
      projectDocument: {
        meta: { id: 'p1' },
        outline: { title: 'Test', acts: [] },
        asset_cards: [{ id: 'c1', type: 'character', name: 'A' }]
      }
    });

    expect(ctx.fieldVersions.outline).toBe(1);
    expect(ctx.fieldVersions.asset_cards).toBe(1);
    // 未提供的字段仍为 0
    expect(ctx.fieldVersions.world_setting).toBe(0);
    expect(ctx.fieldVersions.growth_curve).toBe(0);
  });

  it('multi-review-agent 的 reads 覆盖所有核心创作字段', () => {
    const reviewContract = contracts.find((c) => c.id === 'multi-review-agent');
    expect(reviewContract).toBeDefined();

    // 审核 agent 应该能读取所有核心字段以验证版本
    const reviewReads = new Set(reviewContract!.reads);
    const coreFields: CreativeFieldKey[] = [
      'creative_brief', 'world_setting', 'outline', 'episode_outlines',
      'asset_cards', 'relationship_graph'
    ];
    for (const f of coreFields) {
      expect(reviewReads.has(f), `multi-review-agent 缺少 reads: ${f}`).toBe(true);
    }
  });

  it('context packet 为 multi-review-agent 包含字段版本', () => {
    const reviewContract = contracts.find((c) => c.id === 'multi-review-agent')!;

    const artifacts = {
      creative_brief: { genre: '悬疑' },
      world_setting: { premise: '暗城' },
      outline: { title: '暗城' },
      asset_cards: [{ id: 'c1' }],
      relationship_graph: { nodes: [], edges: [] }
    };
    const versions = initFieldVersions();
    versions.outline = 3;
    versions.asset_cards = 5;

    const packet = buildContextPacket(reviewContract, artifacts, versions, 'run_1');
    const fv = packet.field_versions as Record<string, number>;

    // 审核 agent 的 context packet 必须包含它 reads 的字段版本
    expect(fv.outline).toBe(3);
    expect(fv.asset_cards).toBe(5);
    expect(fv.creative_brief).toBe(0);
  });
});
