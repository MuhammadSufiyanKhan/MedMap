import type { DatasetInfo } from './interactions.js';
import type { Severity, UncheckedReason } from './enums.js';

/**
 * Fixed, reviewed wording for every safety-relevant message in MedMap.
 *
 * SAFETY: these strings are the only clinical-adjacent prose the product shows besides
 * text copied from the interaction dataset. They must never be generated, paraphrased or
 * translated by a language model. Changing any of them needs a human review (see
 * docs/SECURITY.md, "Safety wording").
 *
 * Rules these templates uphold:
 * - never call a combination "safe";
 * - never tell anyone to stop, change, skip or delay a medicine;
 * - always point to a pharmacist or prescriber.
 */
export const SAFETY_TEMPLATES = {
  askPharmacist: 'Ask your pharmacist or prescriber about this combination.',
  urgent: 'For urgent symptoms, contact your local emergency services.',
  notAdvice:
    'MedMap is an information tool. It is not medical advice, and it does not diagnose or set doses.',
  keepTaking:
    'Keep taking your medicines as prescribed unless your pharmacist or prescriber tells you otherwise.',
  supplementCoverage:
    'Supplements, vitamins and herbs are covered less fully than prescription medicines. A missing flag for them means less.',
  demoBanner: 'DEMO DATA, not medical information',
  demoDetail:
    'This copy of MedMap uses a small made-up dataset with invented medicine names. Nothing shown here is real.',
  extractionConsent:
    'Photos you add are sent to the configured label-reading provider to read the text. MedMap does not store your photos.',
  couldNotCheck: 'Could not check',
} as const;

/** Plain-language severity names. Shown as text next to every colour or line style. */
export const SEVERITY_LABELS: Record<Severity, string> = {
  serious: 'Serious',
  moderate: 'Moderate',
  minor: 'Minor',
};

/** Fixed one-line descriptions of what each severity level means in this product. */
export const SEVERITY_DESCRIPTIONS: Record<Severity, string> = {
  serious: 'The source lists this as a serious interaction.',
  moderate: 'The source lists this as a moderate interaction.',
  minor: 'The source lists this as a minor interaction.',
};

export const UNCHECKED_REASON_TEXT: Record<UncheckedReason, string> = {
  not_identified: 'MedMap could not match this name to a known medicine, so it was not checked.',
  not_in_dataset: 'The source has no entries for this medicine, so it was not checked.',
};

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

/** "Source: NAME, version V, updated YYYY-MM-DD". Shown on every results screen. */
export function datasetAttribution(info: DatasetInfo): string {
  return `Source: ${info.name}, version ${info.version}, updated ${formatDate(info.importedAt)}`;
}

/**
 * The only wording allowed for "nothing was flagged". It states what was looked up and
 * where, and makes no claim about the combination itself.
 */
export function noKnownInteractionText(info: DatasetInfo): string {
  return `No known interaction found in this source (${info.name}, version ${info.version}, ${formatDate(info.importedAt)}). This does not mean the combination has no risks.`;
}

/**
 * Words that must never appear as a result label. Tests scan rendered output for these.
 * "unsafe" is included so no result can be phrased on a safe/unsafe scale at all.
 */
export const FORBIDDEN_RESULT_WORDS = ['safe', 'unsafe', 'harmless', 'no risk'] as const;
