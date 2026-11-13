import { z } from 'zod';
import { cursorQuerySchema, isoDateSchema, objectIdSchema, pageSchema } from './common.js';
import {
  MEDICATION_KINDS,
  MEDICATION_SORTS,
  MEDICATION_SOURCES,
  MEDICATION_STATUSES,
} from './enums.js';

/** An RxNorm concept id, or a `DEMO-` id from the demo dataset. Never free text. */
export const rxcuiSchema = z
  .string()
  .regex(/^(?:\d{1,10}|DEMO-\d{4})$/, 'Not a valid drug concept id');

const displayNameSchema = z.string().trim().min(1, 'Enter the medicine name').max(120);
const strengthTextSchema = z.string().trim().max(60).nullable();

export const ingredientSchema = z.object({
  rxcui: z.string(),
  name: z.string(),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export const medicationSchema = z.object({
  id: objectIdSchema,
  profileId: objectIdSchema,
  displayName: z.string(),
  rxcui: z.string().nullable(),
  ingredientRxcuis: z.array(z.string()),
  ingredientNames: z.array(z.string()),
  strengthText: z.string().nullable(),
  kind: z.enum(MEDICATION_KINDS),
  source: z.enum(MEDICATION_SOURCES),
  status: z.enum(MEDICATION_STATUSES),
  version: z.number().int(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
export type Medication = z.infer<typeof medicationSchema>;
export const medicationPageSchema = pageSchema(medicationSchema);

/**
 * Creating a medicine. The client sends the confirmed name and, if the user picked a match,
 * its concept id. Ingredients are always resolved on the server from that id.
 */
export const createMedicationRequestSchema = z.strictObject({
  displayName: displayNameSchema,
  rxcui: rxcuiSchema.nullable().optional(),
  strengthText: strengthTextSchema.optional(),
  kind: z.enum(MEDICATION_KINDS).default('unknown'),
  source: z.enum(MEDICATION_SOURCES).default('manual'),
});
export type CreateMedicationRequest = z.infer<typeof createMedicationRequestSchema>;
export type CreateMedicationInput = z.input<typeof createMedicationRequestSchema>;

export const updateMedicationRequestSchema = z
  .strictObject({
    displayName: displayNameSchema.optional(),
    rxcui: rxcuiSchema.nullable().optional(),
    strengthText: strengthTextSchema.optional(),
    kind: z.enum(MEDICATION_KINDS).optional(),
    status: z.enum(MEDICATION_STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to change');
export type UpdateMedicationRequest = z.infer<typeof updateMedicationRequestSchema>;

export const medicationListQuerySchema = cursorQuerySchema.extend({
  status: z.enum(MEDICATION_STATUSES).optional(),
  sort: z.enum(MEDICATION_SORTS).default('-createdAt'),
});
export type MedicationListQuery = z.infer<typeof medicationListQuerySchema>;

export const medicationParamsSchema = z.strictObject({
  profileId: objectIdSchema,
  medicationId: objectIdSchema,
});

export const normalizeQuerySchema = z.strictObject({
  term: z.string().trim().min(2, 'Type at least 2 characters').max(100),
});
export type NormalizeQuery = z.infer<typeof normalizeQuerySchema>;

export const drugCandidateSchema = z.object({
  rxcui: z.string(),
  name: z.string(),
  /** RxNorm term type such as IN (ingredient), BN (brand name), SCD (clinical drug). */
  termType: z.string(),
  ingredients: z.array(ingredientSchema),
  /** Match score from 0 to 100 when the match was approximate, otherwise null. */
  score: z.number().nullable(),
});
export type DrugCandidate = z.infer<typeof drugCandidateSchema>;

export const normalizeResponseSchema = z.object({
  term: z.string(),
  candidates: z.array(drugCandidateSchema),
  /** Which naming source answered, for attribution in the UI. */
  source: z.string(),
});
export type NormalizeResponse = z.infer<typeof normalizeResponseSchema>;
