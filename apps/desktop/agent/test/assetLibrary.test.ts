import { describe, expect, it } from 'vitest';
import { extractAssetCandidates, classifyPatches } from '../src/engine/assetLibrary';

describe('assetLibrary', () => {
  it('extractAssetCandidates 从 asset_cards 提取新资产', () => {
    const artifact = {
      asset_cards: [
        { id: 'char_1', type: 'character', name: '李探长', sourceRefs: ['intake-agent'] },
        { id: 'loc_1', type: 'location', name: '暗城广场' }
      ]
    };

    const candidates = extractAssetCandidates(artifact, []);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].action).toBe('add');
    expect(candidates[0].targetType).toBe('asset_card');
    expect(candidates[0].autoApply).toBe(true);
  });

  it('extractAssetCandidates 已存在资产标记为 update', () => {
    const artifact = {
      asset_cards: [
        { id: 'char_1', type: 'character', name: '李探长（更新）' }
      ]
    };
    const existing = [{ id: 'char_1', type: 'character', name: '李探长' }];

    const candidates = extractAssetCandidates(artifact, existing);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].action).toBe('update');
  });

  it('extractAssetCandidates locked 资产不自动应用', () => {
    const artifact = {
      asset_cards: [
        { id: 'char_locked', type: 'character', name: '锁定角色' }
      ]
    };
    const existing = [{ id: 'char_locked', type: 'character', name: '锁定角色', status: 'locked' }];

    const candidates = extractAssetCandidates(artifact, existing);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].autoApply).toBe(false);
  });

  it('extractAssetCandidates 从 relationship_graph 提取关系', () => {
    const artifact = {
      relationship_graph: {
        edges: [
          { id: 'e1', from: 'char_1', to: 'char_2', relationType: 'rivalry' }
        ]
      }
    };

    const candidates = extractAssetCandidates(artifact, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].targetType).toBe('relationship_edge');
  });

  it('extractAssetCandidates 跳过无 id 的条目', () => {
    const artifact = {
      asset_cards: [
        { name: '无ID角色' },
        { id: 'char_1', type: 'character', name: '有ID角色' }
      ]
    };

    const candidates = extractAssetCandidates(artifact, []);
    expect(candidates).toHaveLength(1);
  });

  it('extractAssetCandidates 无相关字段时返回空', () => {
    const candidates = extractAssetCandidates({ outline: {} }, []);
    expect(candidates).toEqual([]);
  });

  it('classifyPatches 正确分类', () => {
    const candidates = [
      { id: 'p1', action: 'add' as const, targetType: 'asset_card' as const, targetId: 'c1', payload: {}, sourceRefs: [], autoApply: true },
      { id: 'p2', action: 'update' as const, targetType: 'asset_card' as const, targetId: 'c2', payload: {}, sourceRefs: [], autoApply: false, reason: 'locked' }
    ];

    const { autoApply, needsReview } = classifyPatches(candidates);
    expect(autoApply).toHaveLength(1);
    expect(needsReview).toHaveLength(1);
    expect(needsReview[0].id).toBe('p2');
  });
});
