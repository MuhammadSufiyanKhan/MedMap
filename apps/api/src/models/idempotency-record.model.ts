import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IdempotencyRecordDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  key: string;
  requestHash: string;
  response: {
    status: number;
    body: unknown;
    location: string | null;
    etag: string | null;
  } | null;
  expiresAt: Date;
}

const idempotencyRecordSchema = new Schema<IdempotencyRecordDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
    requestHash: { type: String, required: true },
    response: { type: Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true },
  },
  { strict: 'throw', minimize: false },
);
idempotencyRecordSchema.index({ userId: 1, key: 1 }, { unique: true });
idempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdempotencyRecordModel = model<IdempotencyRecordDoc>(
  'IdempotencyRecord',
  idempotencyRecordSchema,
);
