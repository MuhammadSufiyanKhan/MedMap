import type { InteractionCheck } from '@medmap/shared';

const id = (n: number): string => n.toString(16).padStart(24, '0');

export const DATASET = {
  id: id(999),
  name: 'MedMap demo set',
  version: '1.0.0',
  kind: 'demo' as const,
  licenceStatus: 'not-applicable' as const,
  importedAt: '2026-01-02T03:04:05.000Z',
  pairCount: 8,
};

/** A check with two serious flags on one pair, one moderate, one minor and one unchecked medicine. */
export function sampleCheck(overrides: Partial<InteractionCheck> = {}): InteractionCheck {
  const med = (n: number, displayName: string, checked = true) => ({
    id: id(n),
    displayName,
    strengthText: n === 1 ? '10 mg' : null,
    kind: 'prescription' as const,
    checked,
  });
  const pair = (
    key: string,
    severity: 'serious' | 'moderate' | 'minor',
    a: number,
    nameA: string,
    b: number,
    nameB: string,
  ) => ({
    id: key,
    severity,
    medicationA: { id: id(a), displayName: nameA },
    medicationB: { id: id(b), displayName: nameB },
    ingredientA: { rxcui: `DEMO-000${String(a)}`, name: `ing-${nameA}` },
    ingredientB: { rxcui: `DEMO-000${String(b)}`, name: `ing-${nameB}` },
    mechanism: severity === 'minor' ? null : 'Made-up example for demos. Not a real interaction.',
    sourceRef: `demo:${key}`,
  });
  return {
    id: id(500),
    profileId: id(600),
    createdAt: '2026-11-14T09:30:00.000Z',
    datasetInfo: DATASET,
    medications: [
      med(1, 'Alpha'),
      med(2, 'Beta'),
      med(3, 'Gamma'),
      med(4, 'Delta'),
      med(5, 'Mystery herb', false),
    ],
    flaggedPairs: [
      pair('p1', 'serious', 1, 'Alpha', 2, 'Beta'),
      pair('p2', 'serious', 2, 'Beta', 1, 'Alpha'),
      pair('p3', 'moderate', 1, 'Alpha', 3, 'Gamma'),
      pair('p4', 'minor', 3, 'Gamma', 4, 'Delta'),
    ],
    uncheckedMedications: [{ id: id(5), displayName: 'Mystery herb', reason: 'not_identified' }],
    checkedPairCount: 6,
    summary: { serious: 2, moderate: 1, minor: 1 },
    stale: false,
    ...overrides,
  };
}

export function emptyCheck(): InteractionCheck {
  const base = sampleCheck();
  return {
    ...base,
    medications: base.medications.slice(0, 2),
    flaggedPairs: [],
    uncheckedMedications: [],
    checkedPairCount: 1,
    summary: { serious: 0, moderate: 0, minor: 0 },
  };
}

export { id };
