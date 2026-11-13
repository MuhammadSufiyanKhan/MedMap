import type { Model } from 'mongoose';
import { AuditLogModel } from './audit-log.model.js';
import { ExtractionUsageModel, NormalizationCacheModel } from './cache.model.js';
import { EmailTokenModel } from './email-token.model.js';
import { IdempotencyRecordModel } from './idempotency-record.model.js';
import {
  InteractionCheckModel,
  InteractionDatasetModel,
  InteractionPairModel,
} from './interaction.model.js';
import { InviteModel } from './invite.model.js';
import { MedicationModel } from './medication.model.js';
import { ProfileMemberModel } from './profile-member.model.js';
import { ProfileModel } from './profile.model.js';
import { RefreshTokenModel } from './refresh-token.model.js';
import { UserModel } from './user.model.js';

/** Every model, used by the migration job to create indexes. */
export const ALL_MODELS: Model<never>[] = [
  UserModel,
  RefreshTokenModel,
  EmailTokenModel,
  ProfileModel,
  ProfileMemberModel,
  InviteModel,
  MedicationModel,
  InteractionDatasetModel,
  InteractionPairModel,
  InteractionCheckModel,
  AuditLogModel,
  IdempotencyRecordModel,
  NormalizationCacheModel,
  ExtractionUsageModel,
] as unknown as Model<never>[];
