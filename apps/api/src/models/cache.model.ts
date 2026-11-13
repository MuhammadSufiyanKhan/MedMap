import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface NormalizationCacheDoc {
  _id: Types.ObjectId;
  key: string;
  value: unknown;
  expiresAt: Date;
}

const normalizationCacheSchema = new Schema<NormalizationCacheDoc>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true },
  },
  { strict: 'throw', minimize: false },
);
normalizationCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const NormalizationCacheModel = model<NormalizationCacheDoc>(
  'NormalizationCache',
  normalizationCacheSchema,
);

export interface ExtractionUsageDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** UTC day as YYYY-MM-DD. */
  day: string;
  count: number;
  expiresAt: Date;
}

const extractionUsageSchema = new Schema<ExtractionUsageDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { strict: 'throw' },
);
extractionUsageSchema.index({ userId: 1, day: 1 }, { unique: true });
extractionUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ExtractionUsageModel = model<ExtractionUsageDoc>(
  'ExtractionUsage',
  extractionUsageSchema,
);
