import { z } from 'zod';
import { isoDateSchema, objectIdSchema } from './common.js';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(254));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${String(PASSWORD_MIN_LENGTH)} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${String(PASSWORD_MAX_LENGTH)} characters`);

export const registerRequestSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX_LENGTH),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const userSchema = z.object({
  id: objectIdSchema,
  email: z.string(),
  emailVerified: z.boolean(),
  createdAt: isoDateSchema,
});
export type User = z.infer<typeof userSchema>;

/** Returned by register, login and refresh. The refresh token travels only as an httpOnly cookie. */
export const authResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().describe('Access token lifetime in seconds'),
  user: userSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

const opaqueTokenSchema = z.string().min(20).max(256);

export const tokenConfirmRequestSchema = z.strictObject({ token: opaqueTokenSchema });
export type TokenConfirmRequest = z.infer<typeof tokenConfirmRequestSchema>;

export const passwordResetRequestSchema = z.strictObject({ email: emailSchema });
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConfirmSchema = z.strictObject({
  token: opaqueTokenSchema,
  newPassword: passwordSchema,
});
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;

/** Deleting an account requires the current password so a stolen session cannot do it alone. */
export const deleteAccountRequestSchema = z.strictObject({
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;

export const acceptedResponseSchema = z.object({ message: z.string() });
export type AcceptedResponse = z.infer<typeof acceptedResponseSchema>;

/** Name of the readable CSRF cookie and of the header that must echo it. */
export const CSRF_COOKIE_NAME = 'medmap_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';
