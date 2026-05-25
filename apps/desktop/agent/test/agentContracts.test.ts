import { describe, expect, it } from 'vitest';
import { agentContractSchema, creativeFieldKeys } from '@orison/shared-contracts';
import { getAllAgentContracts, getAgentContract } from '../src/engine/agentContracts';

describe('agentContracts 注册表', () => {
  const contracts = getAllAgentContracts();

  it('注册表包含所有预期 agent', () => {
    const ids = contracts.map((c) => c.id);
    expect(ids).toContain('intake-agent');
    expect(ids).toContain('asset-loader-agent');
    expect(ids).toContain('story-planner-agent');
    expect(ids).toContain('curve-planner-agent');
    expect(ids).toContain('episode-planner-agent');
    expect(ids).toContain('draft-writer-agent');
    expect(ids).toContain('continuity-memory-agent');
    expect(ids).toContain('multi-review-agent');
    expect(ids).toContain('targeted-revision-agent');
  });

  it('每个 contract 都能通过 agentContractSchema 校验', () => {
    for (const c of contracts) {
      expect(() => agentContractSchema.parse(c)).not.toThrow();
    }
  });

  it('getAgentContract 能按 id 查找', () => {
    const c = getAgentContract('story-planner-agent');
    expect(c).toBeDefined();
    expect(c!.role).toBe('故事规划');
  });

  it('getAgentContract 对不存在的 id 返回 undefined', () => {
    expect(getAgentContract('nonexistent')).toBeUndefined();
  });

  it('每个 contract 的 owns 和 reads 不重叠', () => {
    for (const c of contracts) {
      const overlap = c.owns.filter((f) => c.reads.includes(f));
      expect(overlap, `${c.id} owns 和 reads 重叠: ${overlap}`).toEqual([]);
    }
  });

  it('所有 owns 和 reads 都是合法的 CreativeFieldKey', () => {
    const validKeys = new Set(creativeFieldKeys);
    for (const c of contracts) {
      for (const f of [...c.owns, ...c.reads]) {
        expect(validKeys.has(f), `${c.id} 引用了非法字段: ${f}`).toBe(true);
      }
    }
  });

  it('每个有 owns 的核心创作字段至少被一个 agent 拥有', () => {
    const ownedFields = new Set(contracts.flatMap((c) => c.owns));
    // 这些字段必须有 owner
    const requiredOwned = ['creative_brief', 'world_setting', 'outline', 'episode_outlines', 'asset_cards', 'relationship_graph', 'foreshadow_registry'];
    for (const f of requiredOwned) {
      expect(ownedFields.has(f), `字段 ${f} 没有被任何 agent 拥有`).toBe(true);
    }
  });

  it('每个 contract 至少有一条 must 和一条 mustNot', () => {
    for (const c of contracts) {
      expect(c.must.length, `${c.id} 缺少 must`).toBeGreaterThan(0);
      expect(c.mustNot.length, `${c.id} 缺少 mustNot`).toBeGreaterThan(0);
    }
  });
});
