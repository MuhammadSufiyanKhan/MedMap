import type { Request } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@medmap/shared';
import { safeEqual } from '../utils/crypto.js';
import { ForbiddenError } from '../utils/errors.js';

function readCookie(req: Request, name: string): string | undefined {
  const cookies: unknown = req.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }
  const value: unknown = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

export { readCookie };

/**
 * CSRF check for endpoints authenticated by the refresh cookie (double-submit cookie plus
 * an Origin allowlist). The SameSite=Strict cookie already blocks cross-site sends in
 * modern browsers; this is defence in depth.
 * @throws ForbiddenError when the header does not match the cookie or the Origin is unknown.
 */
export function assertCsrf(req: Request, allowedOrigins: string[]): void {
  const origin = req.get('origin');
  if (origin !== undefined && !allowedOrigins.includes(origin)) {
    throw new ForbiddenError('This request came from an unknown origin.', 'csrf-failed');
  }
  const cookie = readCookie(req, CSRF_COOKIE_NAME);
  const header = req.get(CSRF_HEADER_NAME);
  if (cookie === undefined || header === undefined || !safeEqual(cookie, header)) {
    throw new ForbiddenError('The CSRF token is missing or wrong.', 'csrf-failed');
  }
}
