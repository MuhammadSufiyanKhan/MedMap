import type { Request } from 'express';
import { UnauthorizedError } from '../utils/errors.js';

export type AccessTokenVerifier = (token: string) => string;

/**
 * Extracts and verifies the bearer access token.
 * @returns the user id from the verified token. The id is never read from the body or URL.
 * @throws UnauthorizedError when the header is missing or the token is invalid or expired.
 */
export function authenticate(req: Request, verify: AccessTokenVerifier): string {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }
  return verify(header.slice('Bearer '.length).trim());
}
