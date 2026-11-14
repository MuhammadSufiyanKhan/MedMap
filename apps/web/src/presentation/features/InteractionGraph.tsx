import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getStraightPath,
  Handle,
  Position,
  ReactFlow,
} from '@xyflow/react';
import type { Edge, EdgeProps, Node, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import { SEVERITY_LABELS } from '@medmap/shared';
import type { InteractionCheck, Severity } from '@medmap/shared';
import { useGraphBuildIn } from '../../application/animation/hooks';
import { KIND_LABELS } from '../../domain/format';
import { buildGraph, describeEdge, describeNode, EDGE_STYLES } from '../../domain/graph';
import type { GraphEdge, GraphNode } from '../../domain/graph';
import { cn } from '../ui/cn';
import { SeverityIcon, UncheckedBadge } from './severity';

type MedicineNode = Node<{ node: GraphNode }, 'medicine'>;
type FlagEdge = Edge<{ edge: GraphEdge }, 'flag'>;

const SEVERITY_VAR: Record<Severity, string> = {
  serious: 'var(--mm-severity-serious)',
  moderate: 'var(--mm-severity-moderate)',
  minor: 'var(--mm-severity-minor)',
};

/** A medicine drawn as a small bottle label. Unchecked medicines are hatched and dashed. */
function MedicineNodeView({ data }: NodeProps<MedicineNode>) {
  const { node } = data;
  return (
    <div
      data-graph-node
      className={cn(
        'w-40 rounded-md border-2 bg-surface-raised px-3 py-2 text-left shadow-raised',
        node.checked ? 'border-text' : 'hatched border-dashed border-unchecked',
      )}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" isConnectable={false} />
      <p className="text-sm font-bold leading-tight">{node.label}</p>
      {node.strengthText !== null && <p className="text-xs text-text-muted">{node.strengthText}</p>}
      <p className="text-xs text-text-muted">{KIND_LABELS[node.kind]}</p>
      {!node.checked && (
        <div className="mt-1">
          <UncheckedBadge />
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!opacity-0"
        isConnectable={false}
      />
    </div>
  );
}

/**
 * A flagged pair. Severity is carried three ways: line weight and pattern, an icon at the
 * midpoint, and a text label. Colour only reinforces them.
 */
function FlagEdgeView({ sourceX, sourceY, targetX, targetY, data }: EdgeProps<FlagEdge>) {
  const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  if (data === undefined) {
    return null;
  }
  const { severity, count } = data.edge;
  const style = EDGE_STYLES[severity];
  return (
    <>
      <g data-graph-edge>
        <BaseEdge
          path={path}
          style={{
            stroke: SEVERITY_VAR[severity],
            strokeWidth: style.width,
            strokeDasharray: style.dash ?? undefined,
            strokeLinecap: 'round',
          }}
        />
      </g>
      <EdgeLabelRenderer>
        <div
          data-graph-edge
          className={cn(
            'nodrag nopan pointer-events-none absolute flex items-center gap-1 rounded-sm border bg-surface-raised px-1.5 py-0.5 text-xs font-bold',
            `border-severity-${severity} text-severity-${severity}`,
          )}
          // React Flow positions edge labels with a transform computed per render.
          style={{
            transform: `translate(-50%, -50%) translate(${String(labelX)}px, ${String(labelY)}px)`,
          }}
        >
          <SeverityIcon severity={severity} className="size-3.5" />
          {SEVERITY_LABELS[severity]}
          {count > 1 ? ` ×${String(count)}` : ''}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { medicine: MedicineNodeView };
const edgeTypes = { flag: FlagEdgeView };

export interface InteractionGraphProps {
  check: InteractionCheck;
  /** When set, only this medicine and the medicines it is flagged with are drawn. */
  focusId: string | null;
}

/**
 * The node graph: medicines are nodes, flagged pairs are lines. Unflagged pairs are never
 * drawn. Pinch or scroll to zoom, drag to pan; the controls offer the same with buttons.
 */
export default function InteractionGraph({ check, focusId }: InteractionGraphProps) {
  const graph = useMemo(
    () => buildGraph(check, { focusId, width: 760, height: 520 }),
    [check, focusId],
  );
  const scope = useGraphBuildIn<HTMLDivElement>(`${check.id}:${focusId ?? ''}`);

  const nodes: MedicineNode[] = graph.nodes.map((node) => ({
    id: node.id,
    type: 'medicine',
    position: { x: node.x - 80, y: node.y - 30 },
    data: { node },
    ariaLabel: describeNode(node),
    draggable: true,
    connectable: false,
  }));
  const edges: FlagEdge[] = graph.edges.map((edge) => ({
    id: edge.id,
    type: 'flag',
    source: edge.source,
    target: edge.target,
    data: { edge },
    ariaLabel: describeEdge(edge),
    focusable: true,
  }));

  return (
    <div
      ref={scope}
      className="h-[26rem] w-full overflow-hidden rounded-lg border border-border bg-surface-raised md:h-[34rem]"
      role="group"
      aria-label={`Graph of ${String(graph.nodes.length)} medicines and ${String(graph.edges.length)} flagged combinations. A table with the same information follows in the Table tab.`}
      data-testid="interaction-graph"
    >
      <ReactFlow
        key={focusId ?? 'all'}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.3}
        maxZoom={2.5}
        nodesConnectable={false}
        edgesReconnectable={false}
        zoomOnPinch
        panOnDrag
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
