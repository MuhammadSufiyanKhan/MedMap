import { SEVERITIES } from '@medmap/shared';
import type { Severity, SeveritySummary } from '@medmap/shared';

/** Rank of a severity: 0 is the most severe. Used to sort and to pick the worst of a set. */
export function severityRank(severity: Severity): number {
  return SEVERITIES.indexOf(severity);
}

/** Comparator that orders the most severe first. */
export function compareSeverity(a: Severity, b: Severity): number {
  return severityRank(a) - severityRank(b);
}

/** The most severe level in a list, or null for an empty list. */
export function worstSeverity(severities: readonly Severity[]): Severity | null {
  let worst: Severity | null = null;
  for (const severity of severities) {
    if (worst === null || severityRank(severity) < severityRank(worst)) {
      worst = severity;
    }
  }
  return worst;
}

/** Counts flagged pairs per severity. */
export function summarise(severities: readonly Severity[]): SeveritySummary {
  const summary: SeveritySummary = { serious: 0, moderate: 0, minor: 0 };
  for (const severity of severities) {
    summary[severity] += 1;
  }
  return summary;
}
