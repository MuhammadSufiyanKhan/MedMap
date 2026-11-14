import { describe, expect, it } from 'vitest';
import {
  buildCandidatePairs,
  collectIngredients,
  orderPair,
  runInteractionEngine,
} from '../../src/engine/engine.js';
import type { EngineMedication } from '../../src/engine/types.js';
import type { InteractionPairEntity } from '../../src/types/entities.js';

let counter = 0;
function med(displayName: string, ingredientRxcuis: string[]): EngineMedication {
  counter += 1;
  return {
    id: counter.toString(16).padStart(24, '0'),
    displayName,
    strengthText: null,
    kind: 'prescription',
    ingredientRxcuis,
  };
}

function row(
  a: string,
  b: string,
  severity: InteractionPairEntity['severity'],
  extra: Partial<InteractionPairEntity> = {},
): InteractionPairEntity {
  const ordered = orderPair(a, b);
  return {
    datasetId: 'd'.repeat(24),
    ingredientA: ordered.a,
    ingredientB: ordered.b,
    nameA: `name-${ordered.a}`,
    nameB: `name-${ordered.b}`,
    severity,
    mechanism: null,
    sourceRef: `ref:${ordered.a}-${ordered.b}`,
    ...extra,
  };
}

describe('orderPair', () => {
  it('is symmetric', () => {
    expect(orderPair('2', '1')).toEqual(orderPair('1', '2'));
    expect(orderPair('1', '2')).toEqual({ a: '1', b: '2' });
  });
});

describe('collectIngredients', () => {
  it('returns each ingredient once, sorted', () => {
    expect(collectIngredients([med('A', ['3', '1']), med('B', ['1', '2']), med('C', [])])).toEqual([
      '1',
      '2',
      '3',
    ]);
  });
});

describe('buildCandidatePairs', () => {
  it('pairs ingredients across different medicines only', () => {
    const pairs = buildCandidatePairs([med('Combo', ['1', '2']), med('Single', ['3'])]);
    expect(pairs).toEqual([
      { a: '1', b: '3' },
      { a: '2', b: '3' },
    ]);
  });

  it('never pairs an ingredient with itself and de-duplicates', () => {
    const pairs = buildCandidatePairs([
      med('A', ['1']),
      med('B', ['1']),
      med('C', ['2']),
      med('D', ['2']),
    ]);
    expect(pairs).toEqual([{ a: '1', b: '2' }]);
  });

  it('returns nothing for zero or one medicine', () => {
    expect(buildCandidatePairs([])).toEqual([]);
    expect(buildCandidatePairs([med('A', ['1', '2'])])).toEqual([]);
  });
});

describe('runInteractionEngine', () => {
  it('flags only pairs the dataset lists and never reports the others', () => {
    const a = med('Alpha', ['1']);
    const b = med('Beta', ['2']);
    const c = med('Gamma', ['3']);
    const result = runInteractionEngine(
      [a, b, c],
      [row('1', '2', 'moderate')],
      new Set(['1', '2', '3']),
    );
    expect(result.flaggedPairs).toHaveLength(1);
    expect(result.flaggedPairs[0]).toMatchObject({
      severity: 'moderate',
      medicationA: { id: a.id, displayName: 'Alpha' },
      medicationB: { id: b.id, displayName: 'Beta' },
      sourceRef: 'ref:1-2',
    });
    expect(result.checkedPairCount).toBe(3);
    expect(result.summary).toEqual({ serious: 0, moderate: 1, minor: 0 });
    // Unflagged pairs are simply absent: there is no "ok" entry of any kind.
    expect(JSON.stringify(result)).not.toMatch(/safe|ok\b|no interaction/i);
  });

  it('sorts by severity, then by medicine names', () => {
    const meds = [med('Zeta', ['1']), med('Alpha', ['2']), med('Mid', ['3'])];
    const result = runInteractionEngine(
      meds,
      [row('1', '2', 'minor'), row('1', '3', 'serious'), row('2', '3', 'moderate')],
      new Set(['1', '2', '3']),
    );
    expect(result.flaggedPairs.map((p) => p.severity)).toEqual(['serious', 'moderate', 'minor']);
    expect(result.summary).toEqual({ serious: 1, moderate: 1, minor: 1 });
  });

  it('orders equal severities alphabetically', () => {
    const meds = [med('Bravo', ['1']), med('Alpha', ['2']), med('Charlie', ['3'])];
    const result = runInteractionEngine(
      meds,
      [row('1', '3', 'serious'), row('2', '3', 'serious')],
      new Set(['1', '2', '3']),
    );
    expect(result.flaggedPairs.map((p) => p.medicationA.displayName)).toEqual(['Alpha', 'Bravo']);
  });

  it('copies severity, mechanism and source reference unchanged', () => {
    const result = runInteractionEngine(
      [med('A', ['1']), med('B', ['2'])],
      [row('1', '2', 'serious', { mechanism: 'Exact text from the source.', sourceRef: 'SRC-42' })],
      new Set(['1', '2']),
    );
    expect(result.flaggedPairs[0]?.mechanism).toBe('Exact text from the source.');
    expect(result.flaggedPairs[0]?.sourceRef).toBe('SRC-42');
  });

  it('matches regardless of medicine order and maps ingredient names to the right side', () => {
    const first = med('Second-ingredient medicine', ['9']);
    const second = med('First-ingredient medicine', ['1']);
    const result = runInteractionEngine(
      [first, second],
      [row('1', '9', 'minor')],
      new Set(['1', '9']),
    );
    const pair = result.flaggedPairs[0];
    expect(pair?.medicationA.id).toBe(first.id);
    expect(pair?.ingredientA).toEqual({ rxcui: '9', name: 'name-9' });
    expect(pair?.ingredientB).toEqual({ rxcui: '1', name: 'name-1' });
  });

  it('expands multi-ingredient products to each ingredient', () => {
    const combo = med('Combo', ['1', '2']);
    const other = med('Other', ['3']);
    const result = runInteractionEngine(
      [combo, other],
      [row('1', '3', 'minor'), row('2', '3', 'serious')],
      new Set(['1', '2', '3']),
    );
    expect(result.flaggedPairs.map((p) => p.ingredientA.rxcui)).toEqual(['2', '1']);
    expect(result.checkedPairCount).toBe(1);
  });

  it('does not flag ingredients against each other inside one product', () => {
    const result = runInteractionEngine(
      [med('Combo', ['1', '2'])],
      [row('1', '2', 'serious')],
      new Set(['1', '2']),
    );
    expect(result.flaggedPairs).toEqual([]);
    expect(result.checkedPairCount).toBe(0);
  });

  it('reports the same ingredient pair once per medicine pair', () => {
    const result = runInteractionEngine(
      [med('A', ['1', '1']), med('B', ['2'])],
      [row('1', '2', 'minor')],
      new Set(['1', '2']),
    );
    expect(result.flaggedPairs).toHaveLength(1);
  });

  it('ignores a shared ingredient between two products', () => {
    const result = runInteractionEngine([med('A', ['1']), med('B', ['1'])], [], new Set(['1']));
    expect(result.flaggedPairs).toEqual([]);
    expect(result.checkedPairCount).toBe(1);
  });

  it('lists medicines without ingredients as not identified and excludes them from pairs', () => {
    const unknown = med('Mystery pills', []);
    const known = med('Known', ['1']);
    const other = med('Other', ['2']);
    const result = runInteractionEngine([unknown, known, other], [], new Set(['1', '2']));
    expect(result.uncheckedMedications).toEqual([
      { id: unknown.id, displayName: 'Mystery pills', reason: 'not_identified' },
    ]);
    expect(result.checkedPairCount).toBe(1);
    expect(result.medications.find((m) => m.id === unknown.id)?.checked).toBe(false);
    expect(result.medications.find((m) => m.id === known.id)?.checked).toBe(true);
  });

  it('lists medicines the dataset does not cover as not in dataset', () => {
    const herb = med('Herbal tea extract', ['77']);
    const known = med('Known', ['1']);
    const result = runInteractionEngine([herb, known], [], new Set(['1']));
    expect(result.uncheckedMedications).toEqual([
      { id: herb.id, displayName: 'Herbal tea extract', reason: 'not_in_dataset' },
    ]);
    expect(result.checkedPairCount).toBe(0);
  });

  it('treats a product as checked when the dataset knows at least one ingredient', () => {
    const partial = med('Partly covered', ['1', '77']);
    const result = runInteractionEngine([partial, med('B', ['2'])], [], new Set(['1', '2']));
    expect(result.uncheckedMedications).toEqual([]);
    expect(result.checkedPairCount).toBe(1);
  });

  it('handles an empty medicine list', () => {
    expect(runInteractionEngine([], [], new Set())).toEqual({
      medications: [],
      flaggedPairs: [],
      uncheckedMedications: [],
      checkedPairCount: 0,
      summary: { serious: 0, moderate: 0, minor: 0 },
    });
  });

  it('ignores dataset rows that do not involve the given medicines', () => {
    const result = runInteractionEngine(
      [med('A', ['1']), med('B', ['2'])],
      [row('5', '6', 'serious')],
      new Set(['1', '2']),
    );
    expect(result.flaggedPairs).toEqual([]);
  });

  it('keeps every medicine in the snapshot with its kind and strength', () => {
    const supplement: EngineMedication = {
      ...med('Fish oil', []),
      kind: 'supplement',
      strengthText: '1 g',
    };
    const result = runInteractionEngine([supplement], [], new Set());
    expect(result.medications).toEqual([
      {
        id: supplement.id,
        displayName: 'Fish oil',
        strengthText: '1 g',
        kind: 'supplement',
        checked: false,
      },
    ]);
  });

  it('is deterministic for ties', () => {
    const meds = [med('Same', ['1']), med('Same', ['2']), med('Same', ['3'])];
    const rows = [row('1', '2', 'minor'), row('1', '3', 'minor'), row('2', '3', 'minor')];
    const known = new Set(['1', '2', '3']);
    const once = runInteractionEngine(meds, rows, known).flaggedPairs.map((p) => p.id);
    const again = runInteractionEngine(meds, [...rows].reverse(), known).flaggedPairs.map(
      (p) => p.id,
    );
    expect(again).toEqual(once);
  });
});
