import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RelationshipGraphEditor } from '../src/features/creative/RelationshipGraphEditor';
import { useAppStore } from '../src/shared/store/appStore';

describe('RelationshipGraphEditor', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useAppStore.setState({
      activeCreativeTab: 'relationship_graph',
      creativeFields: {},
      fieldMetadata: {},
      updateField: vi.fn(),
      toggleFieldLock: vi.fn(),
      resolvedLocale: 'zh-CN',
      pendingPatch: null,
      patchSelections: {},
      togglePatchSelection: vi.fn(),
      applySelectedPatches: vi.fn(),
      setPendingPatch: vi.fn(),
      setActiveCreativeTab: vi.fn(),
    });
  });

  it('无数据时显示空状态', () => {
    render(<RelationshipGraphEditor />);
    expect(screen.getByText('creative.empty')).toBeTruthy();
  });

  it('有数据时渲染 SVG 画布和节点', () => {
    useAppStore.setState({
      creativeFields: {
        relationship_graph: {
          nodes: [
            { id: 'n1', assetCardId: 'c1', label: '侦探', type: 'character', locked: false },
            { id: 'n2', assetCardId: 'c2', label: '线人', type: 'character', locked: false }
          ],
          edges: [
            { id: 'e1', from: 'n1', to: 'n2', relationType: 'alliance', locked: false, sourceRefs: [] }
          ],
          version: 1,
          updatedBy: 'agent'
        }
      }
    });

    render(<RelationshipGraphEditor />);
    const svg = screen.getByLabelText('Relationship Graph');
    expect(svg).toBeTruthy();
    expect(screen.getByText('侦探')).toBeTruthy();
    expect(screen.getByText('线人')).toBeTruthy();
    expect(screen.getByText('alliance')).toBeTruthy();
  });

  it('工具栏按钮存在', () => {
    useAppStore.setState({
      creativeFields: {
        relationship_graph: {
          nodes: [{ id: 'n1', assetCardId: 'c1', label: '侦探', type: 'character', locked: false }],
          edges: [],
          version: 0,
          updatedBy: 'agent'
        }
      }
    });

    render(<RelationshipGraphEditor />);
    expect(screen.getByText('creative.graph.addEdge')).toBeTruthy();
    expect(screen.getByText('creative.graph.deleteSelected')).toBeTruthy();
  });
});
