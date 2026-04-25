import { useCallback, useRef, useState } from 'react';
import type { z } from 'zod';
import type { relationshipGraphSchema } from '@orison/shared-contracts';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type RelationshipGraph = z.infer<typeof relationshipGraphSchema>;
type NodePos = { x: number; y: number };

const NODE_RADIUS = 28;
const CANVAS_W = 800;
const CANVAS_H = 500;

function defaultLayout(nodes: RelationshipGraph['nodes'], existing?: Record<string, unknown>): Record<string, NodePos> {
  const layout: Record<string, NodePos> = {};
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const r = Math.min(cx, cy) * 0.6;

  nodes.forEach((node, i) => {
    const saved = existing?.[node.id] as NodePos | undefined;
    if (saved?.x != null && saved?.y != null) {
      layout[node.id] = saved;
    } else {
      const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
      layout[node.id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    }
  });
  return layout;
}

export function RelationshipGraphEditor() {
  const data = useAppStore((s) => s.creativeFields.relationship_graph) as RelationshipGraph | undefined;
  const updateField = useAppStore((s) => s.updateField);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  const [positions, setPositions] = useState<Record<string, NodePos>>(() =>
    data ? defaultLayout(data.nodes, data.layout as Record<string, unknown> | undefined) : {}
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [edgeMode, setEdgeMode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMouseDown = useCallback((nodeId: string) => {
    setDragging(nodeId);
    setSelected(nodeId);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPositions((prev) => ({ ...prev, [dragging]: { x, y } }));
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    if (dragging && data) {
      updateField('relationship_graph', { ...data, layout: positions });
    }
    setDragging(null);
  }, [dragging, data, positions, updateField]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (!edgeMode) return;
    if (edgeMode === nodeId) {
      setEdgeMode(null);
      return;
    }
    if (data) {
      const newEdge = {
        id: `e_${Date.now()}`,
        from: edgeMode,
        to: nodeId,
        relationType: 'custom' as const,
        locked: false,
        sourceRefs: []
      };
      updateField('relationship_graph', {
        ...data,
        edges: [...data.edges, newEdge]
      });
    }
    setEdgeMode(null);
  }, [edgeMode, data, updateField]);

  const handleDeleteSelected = useCallback(() => {
    if (!selected || !data) return;
    const isNode = data.nodes.some((n) => n.id === selected);
    if (isNode) {
      updateField('relationship_graph', {
        ...data,
        nodes: data.nodes.filter((n) => n.id !== selected),
        edges: data.edges.filter((e) => e.from !== selected && e.to !== selected)
      });
    } else {
      updateField('relationship_graph', {
        ...data,
        edges: data.edges.filter((e) => e.id !== selected)
      });
    }
    setSelected(null);
  }, [selected, data, updateField]);

  if (!data) {
    return <p className="creative-empty">{t('creative.empty')}</p>;
  }

  return (
    <div className="creative-field-body">
      <div className="graph-toolbar">
        <button
          type="button"
          className={`graph-toolbar-btn${edgeMode ? ' graph-toolbar-btnActive' : ''}`}
          onClick={() => setEdgeMode(edgeMode ? null : selected)}
          disabled={!selected || !data.nodes.some((n) => n.id === selected)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">add_link</span>
          {t('creative.graph.addEdge')}
        </button>
        <button
          type="button"
          className="graph-toolbar-btn"
          onClick={handleDeleteSelected}
          disabled={!selected}
        >
          <span className="material-symbols-outlined" aria-hidden="true">delete</span>
          {t('creative.graph.deleteSelected')}
        </button>
      </div>
      <svg
        ref={svgRef}
        className="relationship-graph-canvas"
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        aria-label="Relationship Graph"
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--on-surface-variant)" />
          </marker>
        </defs>

        {data.edges.map((edge) => {
          const from = positions[edge.from];
          const to = positions[edge.to];
          if (!from || !to) return null;
          const isSelected = edge.id === selected;
          return (
            <g key={edge.id} onClick={() => setSelected(edge.id)} style={{ cursor: 'pointer' }}>
              <line
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                className={`graph-edge${isSelected ? ' graph-edgeSelected' : ''}`}
                markerEnd="url(#arrowhead)"
              />
              <text
                x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 6}
                className="graph-edge-label"
                textAnchor="middle"
              >
                {edge.label ?? edge.relationType}
              </text>
            </g>
          );
        })}

        {data.nodes.map((node) => {
          const pos = positions[node.id];
          if (!pos) return null;
          const isSelected = node.id === selected;
          const isEdgeSource = edgeMode === node.id;
          return (
            <g
              key={node.id}
              onMouseDown={(e) => { e.preventDefault(); handleMouseDown(node.id); }}
              onClick={() => handleNodeClick(node.id)}
              style={{ cursor: dragging === node.id ? 'grabbing' : 'grab' }}
            >
              <circle
                cx={pos.x} cy={pos.y} r={NODE_RADIUS}
                className={`graph-node${isSelected ? ' graph-nodeSelected' : ''}${isEdgeSource ? ' graph-nodeEdgeSource' : ''}`}
              />
              <text
                x={pos.x} y={pos.y + 4}
                className="graph-node-label"
                textAnchor="middle"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
