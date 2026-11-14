import type {
  AuditLog,
  DatasetInfo,
  Invite,
  Medication,
  Member,
  Profile,
  ProfileRole,
  User,
} from '@medmap/shared';
import type {
  AuditLogEntity,
  InteractionDatasetEntity,
  InviteEntity,
  MedicationEntity,
  ProfileEntity,
  ProfileMemberEntity,
  UserEntity,
} from '../types/entities.js';

/** Response mappers: entity in, public JSON shape out. Nothing else leaves the API. */

export function toUserDto(user: UserEntity): User {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toProfileDto(view: {
  profile: ProfileEntity;
  role: ProfileRole;
  activeMedicationCount: number;
}): Profile {
  return {
    id: view.profile.id,
    displayName: view.profile.displayName,
    birthYear: view.profile.birthYear,
    notes: view.profile.notes,
    role: view.role,
    activeMedicationCount: view.activeMedicationCount,
    version: view.profile.version,
    createdAt: view.profile.createdAt.toISOString(),
    updatedAt: view.profile.updatedAt.toISOString(),
  };
}

export function toMemberDto(view: { member: ProfileMemberEntity; email: string }): Member {
  return {
    userId: view.member.userId,
    email: view.email,
    role: view.member.role,
    version: view.member.version,
    joinedAt: view.member.createdAt.toISOString(),
  };
}

export function toInviteDto(invite: InviteEntity): Invite {
  return {
    id: invite.id,
    profileId: invite.profileId,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt ? invite.acceptedAt.toISOString() : null,
    createdAt: invite.createdAt.toISOString(),
  };
}

export function toMedicationDto(medication: MedicationEntity): Medication {
  return {
    id: medication.id,
    profileId: medication.profileId,
    displayName: medication.displayName,
    rxcui: medication.rxcui,
    ingredientRxcuis: medication.ingredientRxcuis,
    ingredientNames: medication.ingredientNames,
    strengthText: medication.strengthText,
    kind: medication.kind,
    source: medication.source,
    status: medication.status,
    version: medication.version,
    createdAt: medication.createdAt.toISOString(),
    updatedAt: medication.updatedAt.toISOString(),
  };
}

export function toAuditLogDto(entry: AuditLogEntity): AuditLog {
  return {
    id: entry.id,
    actorId: entry.actorId,
    profileId: entry.profileId,
    action: entry.action,
    target: entry.target,
    at: entry.at.toISOString(),
  };
}

export function toDatasetInfoDto(dataset: InteractionDatasetEntity): DatasetInfo {
  return {
    id: dataset.id,
    name: dataset.name,
    version: dataset.version,
    kind: dataset.kind,
    licenceStatus: dataset.licenceStatus,
    importedAt: dataset.importedAt.toISOString(),
    pairCount: dataset.pairCount,
  };
}
