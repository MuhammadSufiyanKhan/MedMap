import type { Response } from 'express';
import { CSRF_COOKIE_NAME } from '@medmap/shared';
import type {
  LoginRequest,
  PasswordResetConfirm,
  PasswordResetRequest,
  RegisterRequest,
  TokenConfirmRequest,
} from '@medmap/shared';
import { API_PREFIX, REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from '../config/constants.js';
import { toUserDto } from '../dto/mappers.js';
import type { AuthService, Session } from '../services/auth.service.js';
import { randomToken } from '../utils/crypto.js';
import type { Handler } from '../utils/http.js';

type Body<B> = Handler<unknown, unknown, B>;
type NoInput = Handler<unknown, unknown, unknown>;

function readCookie(cookies: unknown, name: string): string | undefined {
  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }
  const value: unknown = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

/** HTTP handlers for accounts and sessions. Cookie handling lives here and nowhere else. */
export class AuthController {
  public constructor(
    private readonly auth: AuthService,
    private readonly cookieSecure: boolean,
  ) {}

  public register: Body<RegisterRequest> = async (ctx) => {
    const session = await this.auth.register(ctx.body);
    this.setSessionCookies(ctx.res, session);
    return { status: 201, body: this.sessionBody(session), location: `${API_PREFIX}/me` };
  };

  public login: Body<LoginRequest> = async (ctx) => {
    const session = await this.auth.login(ctx.body);
    this.setSessionCookies(ctx.res, session);
    return { status: 200, body: this.sessionBody(session) };
  };

  public refresh: NoInput = async (ctx) => {
    try {
      const session = await this.auth.refresh(readCookie(ctx.req.cookies, REFRESH_COOKIE_NAME));
      this.setSessionCookies(ctx.res, session);
      return { status: 200, body: this.sessionBody(session) };
    } catch (error) {
      this.clearSessionCookies(ctx.res);
      throw error;
    }
  };

  public logout: NoInput = async (ctx) => {
    await this.auth.logout(readCookie(ctx.req.cookies, REFRESH_COOKIE_NAME));
    this.clearSessionCookies(ctx.res);
    return { status: 204 };
  };

  public me: NoInput = async (ctx) => {
    return { status: 200, body: toUserDto(await this.auth.getUser(ctx.userId)) };
  };

  public resendVerification: NoInput = async (ctx) => {
    await this.auth.resendVerification(ctx.userId);
    return {
      status: 202,
      body: { message: 'If your email is not confirmed yet, a new link is on its way.' },
    };
  };

  public confirmVerification: Body<TokenConfirmRequest> = async (ctx) => {
    await this.auth.confirmEmailVerification(ctx.body.token);
    return { status: 204 };
  };

  public requestPasswordReset: Body<PasswordResetRequest> = async (ctx) => {
    await this.auth.requestPasswordReset(ctx.body.email);
    return {
      status: 202,
      body: { message: 'If an account exists for that address, a reset link is on its way.' },
    };
  };

  public confirmPasswordReset: Body<PasswordResetConfirm> = async (ctx) => {
    await this.auth.confirmPasswordReset(ctx.body);
    return { status: 204 };
  };

  private sessionBody(session: Session) {
    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: toUserDto(session.user),
    };
  }

  private setSessionCookies(res: Response, session: Session): void {
    res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      expires: session.refreshExpiresAt,
    });
    // Readable by the web app on purpose: it echoes the value in the X-CSRF-Token header.
    res.cookie(CSRF_COOKIE_NAME, randomToken(24), {
      httpOnly: false,
      secure: this.cookieSecure,
      sameSite: 'strict',
      path: '/',
      expires: session.refreshExpiresAt,
    });
  }

  private clearSessionCookies(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
    });
    res.clearCookie(CSRF_COOKIE_NAME, {
      secure: this.cookieSecure,
      sameSite: 'strict',
      path: '/',
    });
  }
}
