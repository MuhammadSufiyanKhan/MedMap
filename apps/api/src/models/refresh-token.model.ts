import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface RefreshTokenDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  /** All tokens issued from one sign-in share a family, so reuse can revoke the whole chain. */
  family: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const refreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { strict: 'throw' },
);
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model<RefreshTokenDoc>('RefreshToken', refreshTokenSchema);
