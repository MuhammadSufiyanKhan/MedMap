import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    emailVerifiedAt: { type: Date, default: null },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' },
);

export const UserModel = model<UserDoc>('User', userSchema);
