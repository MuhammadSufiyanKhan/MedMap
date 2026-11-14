import { SEVERITIES } from '@medmap/shared';
import type { FlaggedPair, Severity, UncheckedMedication } from '@medmap/shared';
import type { InteractionPairEntity } from '../types/entities.js';
import type { EngineMedication, EngineResult, IngredientPairKey } from './types.js';

/** Orders two ingredient ids so every unordered pair has exactly one key. */
export function orderPair(x: string, y: string): IngredientPairKey {
  return x <= y ? { a: x, b: y } : { a: y, b: x };
}

function keyOf(pair: IngredientPairKey): string {
  return `${pair.a}|${pair.b}`;
}

/** Every distinct ingredient id across the medicines. */
export function collectIngredients(medications: readonly EngineMedication[]): string[] {
  return [...new Set(medications.flatMap((medication) => medication.ingredientRxcuis))].sort();
}

/**
 * The distinct ingredient pairs that need looking up: one ingredient from each of two
 * different medicines. Ingredients inside the same product are not paired with each
 * other, and an ingredient is never paired with itself.
 */
export function buildCandidatePairs(medications: readonly EngineMedication[]): IngredientPairKey[] {
  const pairs = new Map<string, IngredientPairKey>();
  for (let i = 0; i < medications.length; i += 1) {
    for (let j = i + 1; j < medications.length; j += 1) {
      for (const x of medications[i]?.ingredientRxcuis ?? []) {
        for (const y of medications[j]?.ingredientRxcuis ?? []) {
          if (x !== y) {
            const pair = orderPair(x, y);
            pairs.set(keyOf(pair), pair);
          }
        }
      }
    }
  }
  return [...pairs.values()];
}

function severityRank(severity: Severity): number {
  return SEVERITIES.indexOf(severity);
}

/**
 * Turns medicines plus dataset lookups into a check result. Pure: no I/O, no clock.
 *
 * SAFETY:
 * - Only pairs present in `foundPairs` are reported. A pair that is absent is simply not
 *   in the output; nothing here ever labels a combination as fine.
 * - Severity, mechanism and source reference are copied from the dataset unchanged.
 * - A medicine with no ingredients, or whose ingredients the dataset has never heard of,
 *   is returned in `uncheckedMedications` so the UI can show that it was not checked.
 *
 * @param medications the profile's active medicines
 * @param foundPairs dataset rows for the pairs from {@link buildCandidatePairs}
 * @param knownIngredients ingredient ids that appear anywhere in the dataset
 */
export function runInteractionEngine(
  medications: readonly EngineMedication[],
  foundPairs: readonly InteractionPairEntity[],
  knownIngredients: ReadonlySet<string>,
): EngineResult {
  const found = new Map<string, InteractionPairEntity>();
  for (const pair of foundPairs) {
    found.set(keyOf(orderPair(pair.ingredientA, pair.ingredientB)), pair);
  }

  const unchecked: UncheckedMedication[] = [];
  const checkable: EngineMedication[] = [];
  for (const medication of medications) {
    if (medication.ingredientRxcuis.length === 0) {
      unchecked.push({
        id: medication.id,
        displayName: medication.displayName,
        reason: 'not_identified',
      });
    } else if (!medication.ingredientRxcuis.some((id) => knownIngredients.has(id))) {
      unchecked.push({
        id: medication.id,
        displayName: medication.displayName,
        reason: 'not_in_dataset',
      });
    } else {
      checkable.push(medication);
    }
  }
  const uncheckedIds = new Set(unchecked.map((item) => item.id));

  const flagged: FlaggedPair[] = [];
  let checkedPairCount = 0;
  for (let i = 0; i < checkable.length; i += 1) {
    for (let j = i + 1; j < checkable.length; j += 1) {
      const first = checkable[i];
      const second = checkable[j];
      if (first === undefined || second === undefined) {
        continue;
      }
      checkedPairCount += 1;
      const reported = new Set<string>();
      for (const x of first.ingredientRxcuis) {
        for (const y of second.ingredientRxcuis) {
          if (x === y) {
            continue;
          }
          const key = keyOf(orderPair(x, y));
          const row = found.get(key);
          if (row === undefined || reported.has(key)) {
            continue;
          }
          reported.add(key);
          const xIsA = row.ingredientA === x;
          flagged.push({
            id: `${first.id}:${second.id}:${key}`,
            severity: row.severity,
            medicationA: { id: first.id, displayName: first.displayName },
            medicationB: { id: second.id, displayName: second.displayName },
            ingredientA: { rxcui: x, name: xIsA ? row.nameA : row.nameB },
            ingredientB: { rxcui: y, name: xIsA ? row.nameB : row.nameA },
            mechanism: row.mechanism,
            sourceRef: row.sourceRef,
          });
        }
      }
    }
  }

  flagged.sort(
    (left, right) =>
      severityRank(left.severity) - severityRank(right.severity) ||
      left.medicationA.displayName.localeCompare(right.medicationA.displayName) ||
      left.medicationB.displayName.localeCompare(right.medicationB.displayName) ||
      left.id.localeCompare(right.id),
  );

  const summary = { serious: 0, moderate: 0, minor: 0 };
  for (const pair of flagged) {
    summary[pair.severity] += 1;
  }

  return {
    medications: medications.map((medication) => ({
      id: medication.id,
      displayName: medication.displayName,
      strengthText: medication.strengthText,
      kind: medication.kind,
      checked: !uncheckedIds.has(medication.id),
    })),
    flaggedPairs: flagged,
    uncheckedMedications: unchecked,
    checkedPairCount,
    summary,
  };
}
