import { describe, expect, it } from 'vitest';
import { computeAffectedFields, createSyncEvent, markStaleFields, initFieldVersions, getDefaultDependencyGraph } from '../src/engine/workflowSync';

describe('workflowSync', () => {
  it('initFieldVersions 初始化所有字段为 0', () => {
    const versions = initFieldVersions();
    expect(Object.keys(versions)).toHaveLength(10);
    expect(versions.foreshadow_registry).toBe(0);
    for (const v of Object.values(versions)) {
      expect(v).toBe(0);
    }
  });

  it('getDefaultDependencyGraph 包含所有依赖边', () => {
    const graph = getDefaultDependencyGraph();
    expect(graph.edges.length).toBeGreaterThan(0);
    // asset_cards 应该有多个下游
    const assetDownstream = graph.edges.filter((e) => e.upstream === 'asset_cards');
    expect(assetDownstream.length).toBeGreaterThanOrEqual(5);
  });

  it('computeAffectedFields("asset_cards") 返回正确下游', () => {
    const affected = computeAffectedFields('asset_cards');
    expect(affected).toContain('world_setting');
    expect(affected).toContain('outline');
    expect(affected).toContain('episode_outlines');
    expect(affected).toContain('growth_curve');
    expect(affected).toContain('pacing_curve');
    expect(affected).toContain('emotion_curve');
    // asset_cards 不应该影响自己
    expect(affected).not.toContain('asset_cards');
  });

  it('computeAffectedFields("outline") 返回曲线和集纲', () => {
    const affected = computeAffectedFields('outline');
    expect(affected).toContain('growth_curve');
    expect(affected).toContain('pacing_curve');
    expect(affected).toContain('emotion_curve');
    expect(affected).toContain('episode_outlines');
    expect(affected).not.toContain('world_setting');
  });

  it('computeAffectedFields("episode_outlines") 无直接下游', () => {
    const affected = computeAffectedFields('episode_outlines');
    expect(affected).toEqual([]);
  });

  it('computeAffectedFields("foreshadow_registry") refreshes downstream episode planning', () => {
    const affected = computeAffectedFields('foreshadow_registry');
    expect(affected).toContain('episode_outlines');
    expect(affected).not.toContain('foreshadow_registry');
  });

  it('computeAffectedFields 传递性：world_setting 变化影响 episode_outlines', () => {
    const affected = computeAffectedFields('world_setting');
    expect(affected).toContain('episode_outlines');
  });

  it('createSyncEvent 生成合法事件', () => {
    const event = createSyncEvent({
      source: 'agent',
      field: 'asset_cards',
      fromVersion: 1,
      toVersion: 2,
      reason: '新增角色卡'
    });
    expect(event.id).toMatch(/^evt_/);
    expect(event.field).toBe('asset_cards');
    expect(event.fromVersion).toBe(1);
    expect(event.toVersion).toBe(2);
    expect(event.affectedFields.length).toBeGreaterThan(0);
  });

  it('createSyncEvent 支持 entityId', () => {
    const event = createSyncEvent({
      source: 'user',
      field: 'relationship_graph',
      entityId: 'edge_42',
      fromVersion: 0,
      toVersion: 1,
      reason: '用户编辑关系'
    });
    expect(event.entityId).toBe('edge_42');
  });

  it('markStaleFields 合并已有 stale 和新影响', () => {
    const stale = markStaleFields(['outline'], 'asset_cards');
    expect(stale).toContain('outline');
    expect(stale).toContain('world_setting');
    expect(stale).toContain('episode_outlines');
  });

  it('markStaleFields 不重复', () => {
    const stale = markStaleFields(['world_setting', 'outline'], 'asset_cards');
    const unique = new Set(stale);
    expect(stale.length).toBe(unique.size);
  });
});
