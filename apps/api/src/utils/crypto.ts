import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Returns a URL-safe random token with `bytes` bytes of entropy. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * SHA-256 hex digest. Used for high-entropy random tokens (refresh, invite, email), which
 * do not need a slow password hash. Passwords use argon2id instead.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Constant-time string comparison that is safe for values of different lengths. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(sha256(a));
  const bufferB = Buffer.from(sha256(b));
  return timingSafeEqual(bufferA, bufferB);
}
