import { z } from 'zod';
import { userSchema } from './auth.js';
import { cursorQuerySchema, isoDateSchema, objectIdSchema, pageSchema } from './common.js';
import { AUDIT_ACTIONS, PROFILE_ROLES } from './enums.js';
import { datasetInfoSchema, interactionCheckSchema } from './interactions.js';
import { medicationSchema } from './medications.js';
import { inviteSchema, memberSchema, profileSchema } from './profiles.js';

/** Audit entries hold ids only. Medicine names are never written to the audit log. */
export const auditLogSchema = z.object({
  id: objectIdSchema,
  actorId: objectIdSchema.nullable(),
  profileId: objectIdSchema.nullable(),
  action: z.enum(AUDIT_ACTIONS),
  target: z.object({ type: z.string(), id: z.string() }).nullable(),
  at: isoDateSchema,
});
export type AuditLog = z.infer<typeof auditLogSchema>;
export const auditLogPageSchema = pageSchema(auditLogSchema);
export const auditLogQuerySchema = cursorQuerySchema;

/** Full export of everything MedMap holds about the signed-in user. */
export const accountExportSchema = z.object({
  exportedAt: isoDateSchema,
  formatVersion: z.literal(1),
  user: userSchema,
  ownedProfiles: z.array(
    z.object({
      profile: profileSchema,
      medications: z.array(medicationSchema),
      members: z.array(memberSchema),
      invites: z.array(inviteSchema),
      latestInteractionCheck: interactionCheckSchema.nullable(),
    }),
  ),
  /** Profiles shared with the user by someone else. Their contents belong to the owner. */
  sharedWithMe: z.array(
    z.object({
      profileId: objectIdSchema,
      displayName: z.string(),
      role: z.enum(PROFILE_ROLES),
    }),
  ),
  auditLog: z.array(auditLogSchema),
});
export type AccountExport = z.infer<typeof accountExportSchema>;

/** Public, non-sensitive configuration the web app needs before sign-in. */
export const appConfigSchema = z.object({
  dataset: datasetInfoSchema.nullable(),
  demoMode: z.boolean(),
  labelExtraction: z.object({
    enabled: z.boolean(),
    provider: z.string().nullable(),
    maxImages: z.number().int(),
    maxImageBytes: z.number().int(),
  }),
});
export type AppConfig = z.infer<typeof appConfigSchema>;

export const healthSchema = z.object({ status: z.literal('ok') });
export const readinessSchema = z.object({
  status: z.enum(['ok', 'unavailable']),
  checks: z.object({ mongo: z.enum(['ok', 'unavailable']) }),
});
