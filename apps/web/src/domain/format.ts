import type { MedicationKind, ProfileRole, SeveritySummary } from '@medmap/shared';

export const KIND_LABELS: Record<MedicationKind, string> = {
  prescription: 'Prescription',
  otc: 'Over the counter',
  supplement: 'Supplement or herb',
  unknown: 'Not sure',
};

export const ROLE_LABELS: Record<ProfileRole, string> = {
  owner: 'Owner',
  caregiver: 'Caregiver',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<ProfileRole, string> = {
  owner: 'Can change everything and share the profile.',
  caregiver: 'Can see the profile and change its medicines.',
  viewer: 'Can see the profile but not change it.',
};

/** "1 medicine", "3 medicines". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${String(count)} ${count === 1 ? singular : pluralForm}`;
}

/** "2 serious, 1 moderate, 0 minor". Always lists all three so nothing looks omitted. */
export function summaryLine(summary: SeveritySummary): string {
  return `${String(summary.serious)} serious, ${String(summary.moderate)} moderate, ${String(summary.minor)} minor`;
}

/** A date such as "14 November 2026" from an ISO timestamp, in the reader's locale. */
export function formatDate(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    date,
  );
}

/** A date and time such as "14 November 2026, 09:30". */
export function formatDateTime(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Confidence from 0 to 1 as a whole percentage. */
export function formatConfidence(confidence: number): string {
  return `${String(Math.round(Math.min(1, Math.max(0, confidence)) * 100))}%`;
}

/** File size in MB with one decimal. */
export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
