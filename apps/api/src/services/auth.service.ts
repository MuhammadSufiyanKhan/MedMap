import { randomUUID } from 'node:crypto';
import {
  EMAIL_VERIFY_TTL_HOURS,
  LOGIN_LOCK_MINUTES,
  LOGIN_MAX_FAILURES,
  PASSWORD_RESET_TTL_MINUTES,
} from '../config/constants.js';
import type { EmailAdapter } from '../integrations/email/email.js';
import type {
  EmailTokenRepository,
  RefreshTokenRepository,
} from '../repositories/token.repository.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type { UserEntity } from '../types/entities.js';
import { addDays, addMinutes } from '../utils/clock.js';
import type { Clock } from '../utils/clock.js';
import { randomToken, sha256 } from '../utils/crypto.js';
import {
  BadRequestError,
  ConflictError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../utils/errors.js';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../utils/password.js';
import type { AuditService } from './audit.service.js';
import type { TokenService } from './token.service.js';

/** Everything the controller needs to answer a successful sign-in or refresh. */
export interface Session {
  user: UserEntity;
  accessToken: string;
  expiresIn: number;
  /** Raw refresh token. Goes into the httpOnly cookie and nowhere else. */
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface AuthServiceOptions {
  refreshTtlDays: number;
  appBaseUrl: string;
}

/**
 * Accounts, sessions and the email-token flows.
 *
 * Refresh tokens are random, single-use and stored only as SHA-256 hashes. Each refresh
 * rotates the token. Presenting an already-used token revokes its whole family, because
 * that can only happen if the token was copied.
 */
export class AuthService {
  public constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly emailTokens: EmailTokenRepository,
    private readonly tokens: TokenService,
    private readonly email: EmailAdapter,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    private readonly options: AuthServiceOptions,
  ) {}

  /** @throws ConflictError when the email is already registered. */
  public async register(input: { email: string; password: string }): Promise<Session> {
    const passwordHash = await hashPassword(input.password);
    const user = await this.users.create({ email: input.email, passwordHash });
    if (user === null) {
      throw new ConflictError('An account with this email already exists.', 'email-taken');
    }
    await this.audit.record({ actorId: user.id, action: 'user.registered' });
    await this.sendVerificationEmail(user);
    return this.startSession(user, randomUUID());
  }

  /**
   * @throws UnauthorizedError with one uniform message for unknown email and wrong password.
   * @throws TooManyRequestsError while the account is locked after repeated failures.
   */
  public async login(input: { email: string; password: string }): Promise<Session> {
    const now = this.clock();
    const user = await this.users.findByEmail(input.email);
    if (user === null) {
      await verifyPassword(await DUMMY_PASSWORD_HASH, input.password);
      throw new UnauthorizedError('The email or password is not correct.', 'invalid-credentials');
    }
    if (user.lockedUntil !== null && user.lockedUntil > now) {
      throw new TooManyRequestsError(
        'Too many failed sign-in attempts. Try again later or reset your password.',
        (user.lockedUntil.getTime() - now.getTime()) / 1000,
      );
    }
    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      const reachedLimit = user.failedLoginCount + 1 >= LOGIN_MAX_FAILURES;
      await this.users.recordLoginFailure(
        user.id,
        reachedLimit ? addMinutes(now, LOGIN_LOCK_MINUTES) : null,
      );
      throw new UnauthorizedError('The email or password is not correct.', 'invalid-credentials');
    }
    if (user.failedLoginCount > 0 || user.lockedUntil !== null) {
      await this.users.clearLoginFailures(user.id);
    }
    await this.audit.record({ actorId: user.id, action: 'user.login' });
    return this.startSession(user, randomUUID());
  }

  /**
   * Exchanges a refresh token for a new session and rotates the token.
   * @throws UnauthorizedError when the token is unknown, expired or was already used. Reuse
   * also revokes every token of the same family.
   */
  public async refresh(refreshToken: string | undefined): Promise<Session> {
    const invalid = new UnauthorizedError(
      'Your session has ended. Sign in again.',
      'invalid-refresh',
    );
    if (refreshToken === undefined || refreshToken === '') {
      throw invalid;
    }
    const now = this.clock();
    const stored = await this.refreshTokens.findByHash(sha256(refreshToken));
    if (stored === null) {
      throw invalid;
    }
    if (stored.revokedAt !== null) {
      await this.refreshTokens.revokeFamily(stored.family, now);
      throw invalid;
    }
    if (stored.expiresAt <= now) {
      throw invalid;
    }
    const revoked = await this.refreshTokens.revokeIfActive(stored.id, now);
    if (!revoked) {
      await this.refreshTokens.revokeFamily(stored.family, now);
      throw invalid;
    }
    const user = await this.users.findById(stored.userId);
    if (user === null) {
      throw invalid;
    }
    return this.startSession(user, stored.family);
  }

  /** Ends the session the refresh token belongs to. Unknown tokens are ignored. */
  public async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken === undefined || refreshToken === '') {
      return;
    }
    const stored = await this.refreshTokens.findByHash(sha256(refreshToken));
    if (stored === null) {
      return;
    }
    await this.refreshTokens.revokeFamily(stored.family, this.clock());
    await this.audit.record({ actorId: stored.userId, action: 'user.logout' });
  }

  public async getUser(userId: string): Promise<UserEntity> {
    const user = await this.users.findById(userId);
    if (user === null) {
      throw new UnauthorizedError();
    }
    return user;
  }

  /**
   * Checks the password of a signed-in user before a sensitive action.
   * @throws UnauthorizedError when it does not match.
   */
  public async confirmPassword(userId: string, password: string): Promise<UserEntity> {
    const user = await this.getUser(userId);
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new UnauthorizedError('The password is not correct.', 'invalid-credentials');
    }
    return user;
  }

  public async resendVerification(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (user.emailVerifiedAt === null) {
      await this.sendVerificationEmail(user);
    }
  }

  /** @throws BadRequestError when the token is unknown, expired or already used. */
  public async confirmEmailVerification(token: string): Promise<void> {
    const now = this.clock();
    const consumed = await this.emailTokens.consume(sha256(token), 'verify-email', now);
    if (consumed === null) {
      throw new BadRequestError('This link is not valid or has expired.', 'invalid-token');
    }
    await this.users.markEmailVerified(consumed.userId, now);
    await this.audit.record({ actorId: consumed.userId, action: 'user.email_verified' });
  }

  /** Always succeeds from the caller's view, so it cannot be used to discover accounts. */
  public async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (user === null) {
      return;
    }
    const token = randomToken();
    await this.emailTokens.create({
      userId: user.id,
      purpose: 'reset-password',
      tokenHash: sha256(token),
      expiresAt: addMinutes(this.clock(), PASSWORD_RESET_TTL_MINUTES),
    });
    await this.email.send({
      to: user.email,
      subject: 'Reset your MedMap password',
      text: [
        'Someone asked to reset the password for this MedMap account.',
        `Open this link within ${String(PASSWORD_RESET_TTL_MINUTES)} minutes to choose a new password:`,
        `${this.options.appBaseUrl}/reset-password?token=${token}`,
        'If this was not you, you can ignore this email. Your password stays the same.',
      ].join('\n\n'),
    });
  }

  /**
   * Sets a new password and signs the user out everywhere.
   * @throws BadRequestError when the token is unknown, expired or already used.
   */
  public async confirmPasswordReset(input: { token: string; newPassword: string }): Promise<void> {
    const now = this.clock();
    const consumed = await this.emailTokens.consume(sha256(input.token), 'reset-password', now);
    if (consumed === null) {
      throw new BadRequestError('This link is not valid or has expired.', 'invalid-token');
    }
    await this.users.setPasswordHash(consumed.userId, await hashPassword(input.newPassword));
    await this.refreshTokens.revokeAllForUser(consumed.userId, now);
    await this.audit.record({ actorId: consumed.userId, action: 'user.password_reset' });
  }

  private async sendVerificationEmail(user: UserEntity): Promise<void> {
    const token = randomToken();
    await this.emailTokens.create({
      userId: user.id,
      purpose: 'verify-email',
      tokenHash: sha256(token),
      expiresAt: addMinutes(this.clock(), EMAIL_VERIFY_TTL_HOURS * 60),
    });
    await this.email.send({
      to: user.email,
      subject: 'Confirm your email for MedMap',
      text: [
        'Welcome to MedMap.',
        'Open this link to confirm your email address:',
        `${this.options.appBaseUrl}/verify-email?token=${token}`,
        'MedMap is an information tool. It is not medical advice.',
      ].join('\n\n'),
    });
  }

  private async startSession(user: UserEntity, family: string): Promise<Session> {
    const refreshToken = randomToken(48);
    const refreshExpiresAt = addDays(this.clock(), this.options.refreshTtlDays);
    await this.refreshTokens.create({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      family,
      expiresAt: refreshExpiresAt,
    });
    return {
      user,
      accessToken: this.tokens.signAccessToken(user.id),
      expiresIn: this.tokens.accessTtlSeconds,
      refreshToken,
      refreshExpiresAt,
    };
  }
}
