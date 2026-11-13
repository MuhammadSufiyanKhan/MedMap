import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { MEDICATION_KINDS, MEDICATION_SOURCES, MEDICATION_STATUSES } from '@medmap/shared';
import type { MedicationKind, MedicationSource, MedicationStatus } from '@medmap/shared';

export interface MedicationDoc {
  _id: Types.ObjectId;
  profileId: Types.ObjectId;
  displayName: string;
  rxcui: string | null;
  ingredientRxcuis: string[];
  ingredientNames: string[];
  strengthText: string | null;
  kind: MedicationKind;
  source: MedicationSource;
  status: MedicationStatus;
  createdBy: Types.ObjectId;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const medicationSchema = new Schema<MedicationDoc>(
  {
    profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    rxcui: { type: String, default: null },
    ingredientRxcuis: { type: [String], default: [] },
    ingredientNames: { type: [String], default: [] },
    strengthText: { type: String, default: null, maxlength: 60 },
    kind: { type: String, required: true, enum: MEDICATION_KINDS },
    source: { type: String, required: true, enum: MEDICATION_SOURCES },
    status: { type: String, required: true, enum: MEDICATION_STATUSES, default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: true, strict: 'throw' },
);
medicationSchema.index({ profileId: 1, status: 1, _id: -1 });
medicationSchema.index({ profileId: 1, displayName: 1, _id: 1 });

export const MedicationModel = model<MedicationDoc>('Medication', medicationSchema);
