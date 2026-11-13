import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { INVITABLE_ROLES } from '@medmap/shared';
import type { InvitableRole } from '@medmap/shared';

export interface InviteDoc {
  _id: Types.ObjectId;
  profileId: Types.ObjectId;
  email: string;
  role: InvitableRole;
  tokenHash: string;
  invitedBy: Types.ObjectId;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

const inviteSchema = new Schema<InviteDoc>(
  {
    profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, required: true, enum: INVITABLE_ROLES },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' },
);

export const InviteModel = model<InviteDoc>('Invite', inviteSchema);
