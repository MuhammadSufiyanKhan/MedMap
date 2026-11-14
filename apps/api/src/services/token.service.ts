import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors.js';

const ISSUER = 'medmap-api';
const AUDIENCE = 'medmap-web';

/** Signs and verifies short-lived access tokens (HS256, pinned algorithm). */
export class TokenService {
  public constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
  ) {}

  public get accessTtlSeconds(): number {
    return this.ttlSeconds;
  }

  public signAccessToken(userId: string): string {
    return jwt.sign({}, this.secret, {
      algorithm: 'HS256',
      subject: userId,
      expiresIn: this.ttlSeconds,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  }

  /**
   * @returns the user id the token was issued to.
   * @throws UnauthorizedError when the token is malformed, expired or signed with another key.
   */
  public verifyAccessToken(token: string): string {
    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (typeof payload === 'object' && typeof payload.sub === 'string') {
        return payload.sub;
      }
    } catch {
      // fall through to the uniform error below
    }
    throw new UnauthorizedError('Your session has expired. Sign in again.', 'invalid-token');
  }
}
