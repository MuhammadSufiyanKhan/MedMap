import { SEVERITY_LABELS } from '@medmap/shared';
import type { Severity } from '@medmap/shared';

/**
 * The landing-page illustration: a small map of invented medicines, drawn as bottle
 * labels joined by the three line styles. It is a picture of the product, built from the
 * demo names, and is described in text for screen readers.
 */
const NODES = [
  { id: 'a', x: 70, y: 60, name: 'Demolol', detail: '10 mg tablet' },
  { id: 'b', x: 330, y: 40, name: 'Samplifen', detail: '200 mg capsule' },
  { id: 'c', x: 380, y: 230, name: 'Mockstatin', detail: '20 mg tablet' },
  { id: 'd', x: 130, y: 270, name: 'Vitamin Demo', detail: 'supplement' },
  { id: 'e', x: 20, y: 170, name: 'Herbal mix', detail: 'could not check', unchecked: true },
] as const;

const EDGES: { from: string; to: string; severity: Severity }[] = [
  { from: 'a', to: 'b', severity: 'serious' },
  { from: 'a', to: 'c', severity: 'moderate' },
  { from: 'c', to: 'd', severity: 'minor' },
];

const LINE: Record<Severity, { width: number; dash?: string }> = {
  serious: { width: 6 },
  moderate: { width: 3.5, dash: '12 8' },
  minor: { width: 2, dash: '2 7' },
};

const NODE_WIDTH = 150;
const NODE_HEIGHT = 58;

function centre(id: string): { x: number; y: number } {
  const node = NODES.find((item) => item.id === id) ?? NODES[0];
  return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2 };
}

export function HeroMap() {
  return (
    <svg
      viewBox="0 0 550 350"
      width="550"
      height="350"
      className="h-auto w-full max-w-xl"
      role="img"
      aria-labelledby="hero-map-title hero-map-desc"
    >
      <title id="hero-map-title">Example medicine map with made-up medicines</title>
      <desc id="hero-map-desc">
        Five invented medicines shown as labels. A thick solid line marked Serious joins Demolol and
        Samplifen. A dashed line marked Moderate joins Demolol and Mockstatin. A thin dotted line
        marked Minor joins Mockstatin and Vitamin Demo. Herbal mix has a hatched border and is
        marked could not check. Pairs with no flag have no line.
      </desc>
      <defs>
        <pattern
          id="hero-hatch"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="8"
            stroke="var(--mm-unchecked)"
            strokeWidth="2"
            opacity="0.35"
          />
        </pattern>
      </defs>
      {EDGES.map((edge) => {
        const from = centre(edge.from);
        const to = centre(edge.to);
        const style = LINE[edge.severity];
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        return (
          <g key={`${edge.from}-${edge.to}`}>
            <line
              data-edge
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={`var(--mm-severity-${edge.severity})`}
              strokeWidth={style.width}
              strokeDasharray={style.dash}
              strokeLinecap="round"
            />
            <g data-edge-label>
              <rect
                x={mx - 44}
                y={my - 13}
                width="88"
                height="26"
                rx="4"
                fill="var(--mm-surface-raised)"
                stroke={`var(--mm-severity-${edge.severity})`}
                strokeWidth="1.5"
              />
              <text
                x={mx}
                y={my + 5}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                fill={`var(--mm-severity-${edge.severity})`}
              >
                {SEVERITY_LABELS[edge.severity]}
              </text>
            </g>
          </g>
        );
      })}
      {NODES.map((node) => {
        const unchecked = 'unchecked' in node;
        return (
          <g key={node.id} data-node>
            <rect
              x={node.x}
              y={node.y}
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx="8"
              fill="var(--mm-surface-raised)"
              stroke={unchecked ? 'var(--mm-unchecked)' : 'var(--mm-text)'}
              strokeWidth="2"
              strokeDasharray={unchecked ? '6 4' : undefined}
            />
            {unchecked && (
              <rect
                x={node.x}
                y={node.y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx="8"
                fill="url(#hero-hatch)"
              />
            )}
            {!unchecked && (
              <rect
                x={node.x}
                y={node.y}
                width="10"
                height={NODE_HEIGHT}
                rx="4"
                fill="var(--mm-accent)"
              />
            )}
            <text
              x={node.x + 20}
              y={node.y + 25}
              fontSize="16"
              fontWeight="700"
              fill="var(--mm-text)"
            >
              {node.name}
            </text>
            <text x={node.x + 20} y={node.y + 44} fontSize="13" fill="var(--mm-text-muted)">
              {node.detail}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
