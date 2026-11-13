import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface ProfileDoc {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  displayName: string;
  birthYear: number | null;
  notes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const profileSchema = new Schema<ProfileDoc>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    birthYear: { type: Number, default: null },
    notes: { type: String, default: null, maxlength: 1000 },
    version: { type: Number, default: 1 },
  },
  { timestamps: true, strict: 'throw' },
);

export const ProfileModel = model<ProfileDoc>('Profile', profileSchema);
