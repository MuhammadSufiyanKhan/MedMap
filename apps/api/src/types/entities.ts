import type {
  AuditAction,
  DatasetKind,
  InvitableRole,
  LicenceStatus,
  MedicationKind,
  MedicationSource,
  MedicationStatus,
  ProfileRole,
  Severity,
} from '@medmap/shared';

/**
 * Plain data shapes that cross the repository boundary. Services and controllers work
 * with these only; Mongoose documents never leave the repositories.
 */

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdAt: Date;
}

export interface RefreshTokenEntity {
  id: string;
  userId: string;
  tokenHash: string;
  family: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export type EmailTokenPurpose = 'verify-email' | 'reset-password';

export interface EmailTokenEntity {
  id: string;
  userId: string;
  purpose: EmailTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface ProfileEntity {
  id: string;
  ownerId: string;
  displayName: string;
  birthYear: number | null;
  notes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileMemberEntity {
  id: string;
  profileId: string;
  userId: string;
  role: ProfileRole;
  invitedBy: string | null;
  version: number;
  createdAt: Date;
}

export interface InviteEntity {
  id: string;
  profileId: string;
  email: string;
  role: InvitableRole;
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

export interface MedicationEntity {
  id: string;
  profileId: string;
  displayName: string;
  rxcui: string | null;
  ingredientRxcuis: string[];
  ingredientNames: string[];
  strengthText: string | null;
  kind: MedicationKind;
  source: MedicationSource;
  status: MedicationStatus;
  createdBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InteractionDatasetEntity {
  id: string;
  name: string;
  version: string;
  kind: DatasetKind;
  licenceStatus: LicenceStatus;
  importedAt: Date;
  pairCount: number;
  active: boolean;
}

export interface InteractionPairEntity {
  datasetId: string;
  ingredientA: string;
  ingredientB: string;
  nameA: string | null;
  nameB: string | null;
  severity: Severity;
  mechanism: string | null;
  sourceRef: string;
}

export interface AuditLogEntity {
  id: string;
  actorId: string | null;
  profileId: string | null;
  action: AuditAction;
  target: { type: string; id: string } | null;
  at: Date;
}

export interface AuditEntryInput {
  actorId: string | null;
  profileId?: string | null;
  action: AuditAction;
  target?: { type: string; id: string } | null;
}

export interface IdempotencyRecordEntity {
  userId: string;
  key: string;
  requestHash: string;
  response: { status: number; body: unknown; location: string | null; etag: string | null } | null;
}
