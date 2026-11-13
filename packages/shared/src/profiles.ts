import { z } from 'zod';
import { emailSchema } from './auth.js';
import { cursorQuerySchema, isoDateSchema, objectIdSchema, pageSchema } from './common.js';
import { INVITABLE_ROLES, PROFILE_ROLES } from './enums.js';

const currentYear = new Date().getUTCFullYear();

const displayNameSchema = z.string().trim().min(1, 'Enter a name').max(80);
const birthYearSchema = z.number().int().min(1900).max(currentYear).nullable();
const notesSchema = z.string().trim().max(1000).nullable();

export const profileSchema = z.object({
  id: objectIdSchema,
  displayName: z.string(),
  birthYear: z.number().int().nullable(),
  notes: z.string().nullable(),
  /** The calling user's role on this profile. */
  role: z.enum(PROFILE_ROLES),
  activeMedicationCount: z.number().int(),
  version: z.number().int(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
export type Profile = z.infer<typeof profileSchema>;

export const createProfileRequestSchema = z.strictObject({
  displayName: displayNameSchema,
  birthYear: birthYearSchema.optional(),
  notes: notesSchema.optional(),
});
export type CreateProfileRequest = z.infer<typeof createProfileRequestSchema>;

export const updateProfileRequestSchema = z
  .strictObject({
    displayName: displayNameSchema.optional(),
    birthYear: birthYearSchema.optional(),
    notes: notesSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to change');
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const profilePageSchema = pageSchema(profileSchema);
export const profileListQuerySchema = cursorQuerySchema;

export const memberSchema = z.object({
  userId: objectIdSchema,
  email: z.string(),
  role: z.enum(PROFILE_ROLES),
  version: z.number().int(),
  joinedAt: isoDateSchema,
});
export type Member = z.infer<typeof memberSchema>;
export const memberPageSchema = pageSchema(memberSchema);

export const memberParamsSchema = z.strictObject({
  profileId: objectIdSchema,
  userId: objectIdSchema,
});

/** PUT body: the full mutable state of a membership. */
export const replaceMemberRequestSchema = z.strictObject({
  role: z.enum(INVITABLE_ROLES),
});
export type ReplaceMemberRequest = z.infer<typeof replaceMemberRequestSchema>;

export const inviteSchema = z.object({
  id: objectIdSchema,
  profileId: objectIdSchema,
  email: z.string(),
  role: z.enum(INVITABLE_ROLES),
  expiresAt: isoDateSchema,
  acceptedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
});
export type Invite = z.infer<typeof inviteSchema>;
export const invitePageSchema = pageSchema(inviteSchema);

export const createInviteRequestSchema = z.strictObject({
  email: emailSchema,
  role: z.enum(INVITABLE_ROLES),
});
export type CreateInviteRequest = z.infer<typeof createInviteRequestSchema>;

/**
 * The invite token is shown to the inviter exactly once so they can pass the link on
 * themselves if email delivery is not set up. Only a hash is stored.
 */
export const createdInviteSchema = inviteSchema.extend({ token: z.string() });
export type CreatedInvite = z.infer<typeof createdInviteSchema>;

export const inviteParamsSchema = z.strictObject({
  profileId: objectIdSchema,
  inviteId: objectIdSchema,
});

export const inviteAcceptanceRequestSchema = z.strictObject({
  token: z.string().min(20).max(256),
});
export type InviteAcceptanceRequest = z.infer<typeof inviteAcceptanceRequestSchema>;
