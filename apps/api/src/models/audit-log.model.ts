import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { AUDIT_ACTIONS } from '@medmap/shared';
import type { AuditAction } from '@medmap/shared';

export interface AuditLogDoc {
  _id: Types.ObjectId;
  actorId: Types.ObjectId | null;
  profileId: Types.ObjectId | null;
  action: AuditAction;
  target: { type: string; id: string } | null;
  at: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    profileId: { type: Schema.Types.ObjectId, ref: 'Profile', default: null },
    action: { type: String, required: true, enum: AUDIT_ACTIONS },
    target: {
      type: new Schema({ type: String, id: String }, { _id: false }),
      default: null,
    },
    at: { type: Date, required: true },
  },
  { strict: 'throw' },
);
auditLogSchema.index({ profileId: 1, _id: -1 });

// The audit log is append-only. Single-document updates are refused at the model level.
// The only permitted changes are the bulk erasure operations used by account deletion
// (deleteMany / updateMany in the repository), which the privacy policy requires.
const refuseUpdate = (): never => {
  throw new Error('AuditLog is append-only');
};
auditLogSchema.pre('updateOne', refuseUpdate);
auditLogSchema.pre('findOneAndUpdate', refuseUpdate);
auditLogSchema.pre('replaceOne', refuseUpdate);
auditLogSchema.pre('findOneAndReplace', refuseUpdate);
auditLogSchema.pre('findOneAndDelete', refuseUpdate);
auditLogSchema.pre('deleteOne', refuseUpdate);

export const AuditLogModel = model<AuditLogDoc>('AuditLog', auditLogSchema);
