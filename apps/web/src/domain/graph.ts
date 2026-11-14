import type { InteractionCheck, MedicationKind, Severity } from '@medmap/shared';
import { compareSeverity, worstSeverity } from './severity';

export interface GraphNode {
  id: string;
  label: string;
  strengthText: string | null;
  kind: MedicationKind;
  /** False when the medicine could not be checked: drawn hatched with a badge. */
  checked: boolean;
  /** Most severe flag touching this medicine, or null when it has none. */
  worst: Severity | null;
  flagCount: number;
  x: number;
  y: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  /** Most severe flag between the two medicines. */
  severity: Severity;
  /** How many flagged ingredient pairs this line stands for. */
  count: number;
  sourceLabel: string;
  targetLabel: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphOptions {
  /** Show only this medicine and the medicines it is flagged with. */
  focusId?: string | null;
  /** Layout box. Nodes are placed inside it. */
  width?: number;
  height?: number;
}

/** Line style per severity. Severity is never shown by colour alone. */
export const EDGE_STYLES: Record<
  Severity,
  { width: number; dash: string | null; pattern: string }
> = {
  serious: { width: 5, dash: null, pattern: 'thick solid line' },
  moderate: { width: 3, dash: '10 6', pattern: 'dashed line' },
  minor: { width: 1.5, dash: '2 5', pattern: 'thin dotted line' },
};

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Places `count` points evenly on an ellipse, starting at the top. One point sits in the
 * centre; two sit side by side.
 */
export function ellipseLayout(
  count: number,
  width: number,
  height: number,
): { x: number; y: number }[] {
  const cx = width / 2;
  const cy = height / 2;
  if (count === 1) {
    return [{ x: cx, y: cy }];
  }
  const rx = width * 0.38;
  const ry = height * 0.38;
  return Array.from({ length: count }, (_, index) => {
    const angle = (2 * Math.PI * index) / count - Math.PI / 2;
    return {
      x: Math.round(cx + rx * Math.cos(angle)),
      y: Math.round(cy + ry * Math.sin(angle)),
    };
  });
}

/**
 * Turns a check result into nodes and edges.
 *
 * SAFETY: an edge exists only for a flagged pair. Medicines with no flag between them get
 * no line of any kind, so the picture can never suggest a pair was cleared. Medicines that
 * could not be checked stay in the graph, marked `checked: false`.
 */
export function buildGraph(check: InteractionCheck, options: GraphOptions = {}): Graph {
  const width = options.width ?? 800;
  const height = options.height ?? 560;

  const merged = new Map<string, GraphEdge>();
  const severitiesByNode = new Map<string, Severity[]>();
  for (const pair of check.flaggedPairs) {
    const a = pair.medicationA;
    const b = pair.medicationB;
    const key = pairKey(a.id, b.id);
    const existing = merged.get(key);
    if (existing === undefined) {
      merged.set(key, {
        id: key,
        source: a.id,
        target: b.id,
        severity: pair.severity,
        count: 1,
        sourceLabel: a.displayName,
        targetLabel: b.displayName,
      });
    } else {
      existing.count += 1;
      if (compareSeverity(pair.severity, existing.severity) < 0) {
        existing.severity = pair.severity;
      }
    }
    for (const id of [a.id, b.id]) {
      const list = severitiesByNode.get(id) ?? [];
      list.push(pair.severity);
      severitiesByNode.set(id, list);
    }
  }

  let edges = [...merged.values()].sort(
    (left, right) =>
      compareSeverity(left.severity, right.severity) || left.id.localeCompare(right.id),
  );
  let medications = check.medications;

  const focusId = options.focusId ?? null;
  if (focusId !== null && medications.some((medication) => medication.id === focusId)) {
    edges = edges.filter((edge) => edge.source === focusId || edge.target === focusId);
    const visible = new Set<string>([focusId]);
    for (const edge of edges) {
      visible.add(edge.source).add(edge.target);
    }
    medications = medications.filter((medication) => visible.has(medication.id));
  }

  const positions = ellipseLayout(medications.length, width, height);
  const nodes: GraphNode[] = medications.map((medication, index) => {
    const severities = severitiesByNode.get(medication.id) ?? [];
    const position = positions[index] ?? { x: width / 2, y: height / 2 };
    return {
      id: medication.id,
      label: medication.displayName,
      strengthText: medication.strengthText,
      kind: medication.kind,
      checked: medication.checked,
      worst: worstSeverity(severities),
      flagCount: severities.length,
      x: position.x,
      y: position.y,
    };
  });

  return { nodes, edges };
}

/** Screen-reader description of one line in the graph. */
export function describeEdge(edge: GraphEdge): string {
  const more = edge.count > 1 ? `, ${String(edge.count)} flagged ingredient pairs` : '';
  return `${edge.severity} interaction between ${edge.sourceLabel} and ${edge.targetLabel}${more}`;
}

/** Screen-reader description of one medicine in the graph. */
export function describeNode(node: GraphNode): string {
  if (!node.checked) {
    return `${node.label}: could not check`;
  }
  if (node.flagCount === 0) {
    return `${node.label}: no flags in this source`;
  }
  return `${node.label}: ${String(node.flagCount)} ${node.flagCount === 1 ? 'flag' : 'flags'}, most severe ${node.worst ?? ''}`;
}
