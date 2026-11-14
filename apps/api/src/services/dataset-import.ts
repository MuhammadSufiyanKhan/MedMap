import { z } from 'zod';
import { SEVERITIES } from '@medmap/shared';
import type { ImportPair } from './dataset.service.js';

/** Why a CSV row was not imported. Collected into the import report. */
export interface RowProblem {
  line: number;
  reason: string;
}

const concept = z.string().regex(/^(?:\d{1,10}|DEMO-\d{4})$/);

const medmapRowSchema = z.object({
  ingredient_a_rxcui: concept,
  ingredient_b_rxcui: concept,
  severity: z.enum(SEVERITIES),
  source_ref: z.string().min(1).max(200),
  mechanism: z.string().max(1000).optional(),
  name_a: z.string().max(200).optional(),
  name_b: z.string().max(200).optional(),
});

function emptyToNull(value: string | undefined): string | null {
  return value === undefined || value === '' ? null : value;
}

/**
 * Maps one row of MedMap's own CSV format. Columns: `ingredient_a_rxcui`,
 * `ingredient_b_rxcui`, `severity` (serious|moderate|minor), `source_ref`, and optionally
 * `mechanism`, `name_a`, `name_b`.
 * @returns the pair, or a reason the row is not usable. Values are never altered.
 */
export function mapMedmapRow(record: Record<string, string>): ImportPair | string {
  const parsed = medmapRowSchema.safeParse(record);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return `${issue?.path.join('.') ?? 'row'}: ${issue?.message ?? 'invalid'}`;
  }
  const row = parsed.data;
  return {
    ingredientA: row.ingredient_a_rxcui,
    ingredientB: row.ingredient_b_rxcui,
    nameA: emptyToNull(row.name_a),
    nameB: emptyToNull(row.name_b),
    severity: row.severity,
    mechanism: emptyToNull(row.mechanism),
    sourceRef: row.source_ref,
  };
}

const DDINTER_LEVELS: Record<string, ImportPair['severity']> = {
  major: 'serious',
  moderate: 'moderate',
  minor: 'minor',
};

/** Resolves a drug name to exactly one ingredient concept, or null when it is ambiguous. */
export type NameResolver = (name: string) => Promise<{ rxcui: string; name: string } | null>;

/**
 * Maps one row of a DDInter-style export. Expected columns: `ddinterid_a`, `drug_a`,
 * `ddinterid_b`, `drug_b`, `level` (Major|Moderate|Minor|Unknown).
 *
 * DDInter identifies drugs by name, so each name is resolved to an RxNorm ingredient. Rows
 * with level "Unknown", or with a name that does not resolve to exactly one ingredient,
 * are skipped and reported; nothing is guessed.
 *
 * The column layout must be checked against the real file before a production import:
 * this project never downloads the dataset, so the mapping was written from the public
 * description of the format.
 */
export async function mapDdinterRow(
  record: Record<string, string>,
  resolveName: NameResolver,
): Promise<ImportPair | string> {
  const drugA = record.drug_a ?? '';
  const drugB = record.drug_b ?? '';
  const level = (record.level ?? '').toLowerCase();
  if (drugA === '' || drugB === '') {
    return 'missing drug name';
  }
  const severity = DDINTER_LEVELS[level];
  if (severity === undefined) {
    return `level "${record.level ?? ''}" is not imported`;
  }
  const [a, b] = await Promise.all([resolveName(drugA), resolveName(drugB)]);
  if (a === null) {
    return `could not map "${drugA}" to one ingredient`;
  }
  if (b === null) {
    return `could not map "${drugB}" to one ingredient`;
  }
  const idA = record.ddinterid_a ?? '';
  const idB = record.ddinterid_b ?? '';
  return {
    ingredientA: a.rxcui,
    ingredientB: b.rxcui,
    nameA: a.name,
    nameB: b.name,
    severity,
    mechanism: null,
    sourceRef: idA !== '' && idB !== '' ? `ddinter:${idA}-${idB}` : 'ddinter',
  };
}
