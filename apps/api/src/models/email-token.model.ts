import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import type { EmailTokenPurpose } from '../types/entities.js';

export interface EmailTokenDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  purpose: EmailTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

const emailTokenSchema = new Schema<EmailTokenDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, required: true, enum: ['verify-email', 'reset-password'] },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { strict: 'throw' },
);
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailTokenModel = model<EmailTokenDoc>('EmailToken', emailTokenSchema);
