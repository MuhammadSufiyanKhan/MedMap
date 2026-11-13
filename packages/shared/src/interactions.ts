import { z } from 'zod';
import { isoDateSchema, objectIdSchema } from './common.js';
import {
  DATASET_KINDS,
  LICENCE_STATUSES,
  MEDICATION_KINDS,
  SEVERITIES,
  UNCHECKED_REASONS,
} from './enums.js';

/** Identifies the interaction dataset a result came from. Shown on every results screen. */
export const datasetInfoSchema = z.object({
  id: objectIdSchema,
  name: z.string(),
  version: z.string(),
  kind: z.enum(DATASET_KINDS),
  licenceStatus: z.enum(LICENCE_STATUSES),
  importedAt: isoDateSchema,
  pairCount: z.number().int(),
});
export type DatasetInfo = z.infer<typeof datasetInfoSchema>;

const medicationRefSchema = z.object({
  id: objectIdSchema,
  displayName: z.string(),
});

const ingredientRefSchema = z.object({
  rxcui: z.string(),
  name: z.string().nullable(),
});

/**
 * One flagged pair. `severity`, `mechanism` and `sourceRef` are copied from the dataset
 * unchanged. Nothing in this object is machine-written prose.
 */
export const flaggedPairSchema = z.object({
  id: z.string(),
  severity: z.enum(SEVERITIES),
  medicationA: medicationRefSchema,
  medicationB: medicationRefSchema,
  ingredientA: ingredientRefSchema,
  ingredientB: ingredientRefSchema,
  mechanism: z.string().nullable(),
  sourceRef: z.string(),
});
export type FlaggedPair = z.infer<typeof flaggedPairSchema>;

export const uncheckedMedicationSchema = z.object({
  id: objectIdSchema,
  displayName: z.string(),
  reason: z.enum(UNCHECKED_REASONS),
});
export type UncheckedMedication = z.infer<typeof uncheckedMedicationSchema>;

/** Snapshot of a medicine at the time of the check; these become the graph nodes. */
export const checkedMedicationSchema = z.object({
  id: objectIdSchema,
  displayName: z.string(),
  strengthText: z.string().nullable(),
  kind: z.enum(MEDICATION_KINDS),
  checked: z.boolean(),
});
export type CheckedMedication = z.infer<typeof checkedMedicationSchema>;

export const severitySummarySchema = z.object({
  serious: z.number().int(),
  moderate: z.number().int(),
  minor: z.number().int(),
});
export type SeveritySummary = z.infer<typeof severitySummarySchema>;

export const interactionCheckSchema = z.object({
  id: objectIdSchema,
  profileId: objectIdSchema,
  createdAt: isoDateSchema,
  datasetInfo: datasetInfoSchema,
  medications: z.array(checkedMedicationSchema),
  flaggedPairs: z.array(flaggedPairSchema),
  uncheckedMedications: z.array(uncheckedMedicationSchema),
  /** Number of distinct medicine pairs that were looked up in the dataset. */
  checkedPairCount: z.number().int(),
  summary: severitySummarySchema,
  /** True when the medicine list changed after this check was run. */
  stale: z.boolean(),
});
export type InteractionCheck = z.infer<typeof interactionCheckSchema>;
