/** Roles a user can hold on a profile, from most to least privileged. */
export const PROFILE_ROLES = ['owner', 'caregiver', 'viewer'] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];

/** Roles that can be granted through an invite. Ownership is never transferable by invite. */
export const INVITABLE_ROLES = ['caregiver', 'viewer'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const MEDICATION_KINDS = ['prescription', 'otc', 'supplement', 'unknown'] as const;
export type MedicationKind = (typeof MEDICATION_KINDS)[number];

export const MEDICATION_SOURCES = ['label', 'manual'] as const;
export type MedicationSource = (typeof MEDICATION_SOURCES)[number];

export const MEDICATION_STATUSES = ['active', 'stopped'] as const;
export type MedicationStatus = (typeof MEDICATION_STATUSES)[number];

/** Severity levels, ordered from most to least severe. The order is used for ranking. */
export const SEVERITIES = ['serious', 'moderate', 'minor'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const DATASET_KINDS = ['real', 'demo'] as const;
export type DatasetKind = (typeof DATASET_KINDS)[number];

export const LICENCE_STATUSES = ['unverified', 'confirmed', 'not-applicable'] as const;
export type LicenceStatus = (typeof LICENCE_STATUSES)[number];

/**
 * Why a medicine could not be checked.
 * - `not_identified`: no ingredient could be matched for the name.
 * - `not_in_dataset`: ingredients were matched, but the dataset has no entries at all for them,
 *   so "no flag" would say nothing about this medicine.
 */
export const UNCHECKED_REASONS = ['not_identified', 'not_in_dataset'] as const;
export type UncheckedReason = (typeof UNCHECKED_REASONS)[number];

export const AUDIT_ACTIONS = [
  'user.registered',
  'user.login',
  'user.logout',
  'user.password_reset',
  'user.email_verified',
  'user.exported',
  'profile.created',
  'profile.updated',
  'profile.deleted',
  'member.role_changed',
  'member.removed',
  'invite.created',
  'invite.revoked',
  'invite.accepted',
  'medication.created',
  'medication.updated',
  'medication.deleted',
  'label_extraction.requested',
  'interaction_check.run',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const MEDICATION_SORTS = ['-createdAt', 'createdAt', 'displayName'] as const;
export type MedicationSort = (typeof MEDICATION_SORTS)[number];
