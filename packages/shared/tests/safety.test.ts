import { describe, expect, it } from 'vitest';
import {
  datasetAttribution,
  FORBIDDEN_RESULT_WORDS,
  noKnownInteractionText,
  SAFETY_TEMPLATES,
  SEVERITIES,
  SEVERITY_DESCRIPTIONS,
  SEVERITY_LABELS,
  UNCHECKED_REASON_TEXT,
} from '../src/index.js';
import type { DatasetInfo } from '../src/index.js';

const info: DatasetInfo = {
  id: 'a'.repeat(24),
  name: 'MedMap demo set',
  version: '1.0.0',
  kind: 'demo',
  licenceStatus: 'not-applicable',
  importedAt: '2026-01-02T03:04:05.000Z',
  pairCount: 8,
};

function allSafetyText(): string[] {
  return [
    ...Object.values(SAFETY_TEMPLATES),
    ...Object.values(SEVERITY_LABELS),
    ...Object.values(SEVERITY_DESCRIPTIONS),
    ...Object.values(UNCHECKED_REASON_TEXT),
    datasetAttribution(info),
    noKnownInteractionText(info),
  ];
}

describe('safety templates', () => {
  it('are frozen wording (snapshot): changing them needs a human review', () => {
    expect(SAFETY_TEMPLATES).toMatchInlineSnapshot(`
      {
        "askPharmacist": "Ask your pharmacist or prescriber about this combination.",
        "couldNotCheck": "Could not check",
        "demoBanner": "DEMO DATA, not medical information",
        "demoDetail": "This copy of MedMap uses a small made-up dataset with invented medicine names. Nothing shown here is real.",
        "extractionConsent": "Photos you add are sent to the configured label-reading provider to read the text. MedMap does not store your photos.",
        "keepTaking": "Keep taking your medicines as prescribed unless your pharmacist or prescriber tells you otherwise.",
        "notAdvice": "MedMap is an information tool. It is not medical advice, and it does not diagnose or set doses.",
        "supplementCoverage": "Supplements, vitamins and herbs are covered less fully than prescription medicines. A missing flag for them means less.",
        "urgent": "For urgent symptoms, contact your local emergency services.",
      }
    `);
  });

  it('never use a forbidden result word', () => {
    for (const text of allSafetyText()) {
      for (const word of FORBIDDEN_RESULT_WORDS) {
        expect(text.toLowerCase()).not.toMatch(new RegExp(`\\b${word}\\b`));
      }
    }
  });

  it('never tell the reader to stop, skip, change or delay a medicine', () => {
    const forbidden =
      /\b(stop taking|do not take|don't take|skip|discontinue|delay|change your dose)\b/i;
    for (const text of allSafetyText()) {
      expect(text).not.toMatch(forbidden);
    }
  });

  it('describe "no flag" with the dataset name, version and date and without reassurance', () => {
    const text = noKnownInteractionText(info);
    expect(text).toContain('No known interaction found in this source');
    expect(text).toContain('MedMap demo set');
    expect(text).toContain('1.0.0');
    expect(text).toContain('2026-01-02');
    expect(text).toContain('does not mean');
  });

  it('attribute the dataset', () => {
    expect(datasetAttribution(info)).toBe(
      'Source: MedMap demo set, version 1.0.0, updated 2026-01-02',
    );
  });

  it('cover every severity with a text label', () => {
    for (const severity of SEVERITIES) {
      expect(SEVERITY_LABELS[severity].length).toBeGreaterThan(0);
      expect(SEVERITY_DESCRIPTIONS[severity]).toContain(severity);
    }
  });
});
