import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { DATASET_KINDS, LICENCE_STATUSES, SEVERITIES } from '@medmap/shared';
import type { DatasetKind, InteractionCheck, LicenceStatus, Severity } from '@medmap/shared';

export interface InteractionDatasetDoc {
  _id: Types.ObjectId;
  name: string;
  version: string;
  kind: DatasetKind;
  licenceStatus: LicenceStatus;
  importedAt: Date;
  pairCount: number;
  active: boolean;
}

const interactionDatasetSchema = new Schema<InteractionDatasetDoc>(
  {
    name: { type: String, required: true },
    version: { type: String, required: true },
    kind: { type: String, required: true, enum: DATASET_KINDS },
    licenceStatus: { type: String, required: true, enum: LICENCE_STATUSES },
    importedAt: { type: Date, required: true },
    pairCount: { type: Number, required: true },
    active: { type: Boolean, default: false, index: true },
  },
  { strict: 'throw' },
);
interactionDatasetSchema.index({ name: 1, version: 1 }, { unique: true });

export const InteractionDatasetModel = model<InteractionDatasetDoc>(
  'InteractionDataset',
  interactionDatasetSchema,
);

export interface InteractionPairDoc {
  _id: Types.ObjectId;
  datasetId: Types.ObjectId;
  /** `ingredientA` always sorts before `ingredientB`, so each pair is stored once. */
  ingredientA: string;
  ingredientB: string;
  nameA: string | null;
  nameB: string | null;
  severity: Severity;
  mechanism: string | null;
  sourceRef: string;
}

const interactionPairSchema = new Schema<InteractionPairDoc>(
  {
    datasetId: { type: Schema.Types.ObjectId, ref: 'InteractionDataset', required: true },
    ingredientA: { type: String, required: true },
    ingredientB: { type: String, required: true },
    nameA: { type: String, default: null },
    nameB: { type: String, default: null },
    severity: { type: String, required: true, enum: SEVERITIES },
    mechanism: { type: String, default: null },
    sourceRef: { type: String, required: true },
  },
  { strict: 'throw' },
);
interactionPairSchema.index({ datasetId: 1, ingredientA: 1, ingredientB: 1 }, { unique: true });
// Lets "does the dataset know this ingredient at all" be answered from either side.
interactionPairSchema.index({ datasetId: 1, ingredientB: 1 });

export const InteractionPairModel = model<InteractionPairDoc>(
  'InteractionPair',
  interactionPairSchema,
);

/** Stored result of one check, minus the fields computed at read time. */
export type StoredCheckResult = Omit<InteractionCheck, 'id' | 'profileId' | 'createdAt' | 'stale'>;

export interface InteractionCheckDoc {
  _id: Types.ObjectId;
  profileId: Types.ObjectId;
  createdBy: Types.ObjectId | null;
  /** Hash of the active medicine list the check was computed from. */
  fingerprint: string;
  result: StoredCheckResult;
  createdAt: Date;
}

const interactionCheckSchema = new Schema<InteractionCheckDoc>(
  {
    profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    fingerprint: { type: String, required: true },
    result: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', minimize: false },
);
interactionCheckSchema.index({ profileId: 1, _id: -1 });

export const InteractionCheckModel = model<InteractionCheckDoc>(
  'InteractionCheck',
  interactionCheckSchema,
);
