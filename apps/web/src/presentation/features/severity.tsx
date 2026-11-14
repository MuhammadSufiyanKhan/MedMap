import { Circle, CircleHelp, Diamond, TriangleAlert } from 'lucide-react';
import { SAFETY_TEMPLATES, SEVERITY_LABELS } from '@medmap/shared';
import type { Severity } from '@medmap/shared';
import { Badge } from '../ui/Card';

const ICONS: Record<Severity, typeof TriangleAlert> = {
  serious: TriangleAlert,
  moderate: Diamond,
  minor: Circle,
};

/** Icon shape per severity: triangle, diamond, circle. Shape backs up colour. */
export function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  const Icon = ICONS[severity];
  return <Icon aria-hidden="true" className={className ?? 'size-4'} />;
}

/**
 * Severity as text plus icon plus colour. Static by design: it never animates, pulses or
 * fades in.
 */
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge tone={severity} icon={<SeverityIcon severity={severity} />}>
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}

/** "Could not check" marker: hatched, dashed and labelled. */
export function UncheckedBadge() {
  return (
    <Badge tone="unchecked" icon={<CircleHelp aria-hidden="true" className="size-4" />}>
      {SAFETY_TEMPLATES.couldNotCheck}
    </Badge>
  );
}

/** Sample of the line style used for a severity in the graph, for legends. */
export function LineSample({ severity }: { severity: Severity }) {
  const style = {
    serious: { width: 5, dash: undefined },
    moderate: { width: 3, dash: '10 6' },
    minor: { width: 1.5, dash: '2 5' },
  }[severity];
  return (
    <svg width="56" height="12" aria-hidden="true" className={`text-severity-${severity} shrink-0`}>
      <line
        x1="2"
        y1="6"
        x2="54"
        y2="6"
        stroke="currentColor"
        strokeWidth={style.width}
        strokeDasharray={style.dash}
        strokeLinecap="round"
      />
    </svg>
  );
}
