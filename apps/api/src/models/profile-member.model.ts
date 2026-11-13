import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { PROFILE_ROLES } from '@medmap/shared';
import type { ProfileRole } from '@medmap/shared';

export interface ProfileMemberDoc {
  _id: Types.ObjectId;
  profileId: Types.ObjectId;
  userId: Types.ObjectId;
  role: ProfileRole;
  invitedBy: Types.ObjectId | null;
  version: number;
  createdAt: Date;
}

const profileMemberSchema = new Schema<ProfileMemberDoc>(
  {
    profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, required: true, enum: PROFILE_ROLES },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    version: { type: Number, default: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' },
);
profileMemberSchema.index({ profileId: 1, userId: 1 }, { unique: true });
profileMemberSchema.index({ userId: 1, profileId: 1 });

export const ProfileMemberModel = model<ProfileMemberDoc>('ProfileMember', profileMemberSchema);
