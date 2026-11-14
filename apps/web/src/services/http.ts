import type { z } from 'zod';
import {
  authResponseSchema,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  problemSchema,
} from '@medmap/shared';
import type { AuthResponse } from '@medmap/shared';
import { ApiError } from '../domain/errors';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  formData?: FormData;
  /** Schema of the success body. The response is parsed with it, so drift is caught. */
  schema?: z.ZodType<T>;
  /** Resource version to send as `If-Match`. */
  ifMatch?: number;
  idempotencyKey?: string;
  /** Send the bearer token. Defaults to true. */
  auth?: boolean;
  /** Send the CSRF header (cookie-authenticated endpoints). */
  csrf?: boolean;
  signal?: AbortSignal;
}

export interface ApiResult<T> {
  data: T;
  /** Version from the `ETag` header, for the next `If-Match`. */
  version: number | null;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function parseVersion(etag: string | null): number | null {
  const match = etag === null ? null : /^"v(\d+)"$/.exec(etag);
  return match?.[1] === undefined ? null : Number(match[1]);
}

/**
 * Typed fetch wrapper for the MedMap API.
 *
 * - Keeps the access token in memory only; it is never written to storage.
 * - On a 401 it refreshes the session once (using the httpOnly cookie) and retries.
 * - Turns every failure into an {@link ApiError}.
 */
export class ApiClient {
  private accessToken: string | null = null;
  private refreshing: Promise<AuthResponse | null> | null = null;
  private onSessionLost: (() => void) | null = null;

  public constructor(
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
    private readonly baseUrl = '/api/v1',
  ) {}

  public setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  public hasAccessToken(): boolean {
    return this.accessToken !== null;
  }

  /** Called when a refresh fails, so the app can send the user to sign in. */
  public setSessionLostHandler(handler: (() => void) | null): void {
    this.onSessionLost = handler;
  }

  /** True when the browser holds the CSRF cookie, meaning a session may exist. */
  public mayHaveSession(): boolean {
    return readCookie(CSRF_COOKIE_NAME) !== null;
  }

  /**
   * Exchanges the refresh cookie for a new access token. Concurrent callers share one
   * request, because the refresh token is single-use.
   * @returns the session, or null when there is none.
   */
  public refresh(): Promise<AuthResponse | null> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  public async request<T = undefined>(
    path: string,
    options: RequestOptions<T> = {},
  ): Promise<ApiResult<T>> {
    const useAuth = options.auth !== false;
    let response = await this.send(path, options, useAuth);
    if (response.status === 401 && useAuth && this.mayHaveSession()) {
      const session = await this.refresh();
      if (session === null) {
        this.onSessionLost?.();
      } else {
        response = await this.send(path, options, true);
      }
    }
    if (!response.ok) {
      throw await this.toError(response);
    }
    const version = parseVersion(response.headers.get('etag'));
    if (response.status === 204 || options.schema === undefined) {
      return { data: undefined as T, version };
    }
    const json: unknown = await response.json();
    const parsed = options.schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError({
        status: response.status,
        code: 'unexpected-response',
        message: 'The server sent something MedMap did not understand. Try again.',
      });
    }
    return { data: parsed.data, version };
  }

  private async doRefresh(): Promise<AuthResponse | null> {
    if (!this.mayHaveSession()) {
      this.accessToken = null;
      return null;
    }
    try {
      const response = await this.send('/auth/refresh', { method: 'POST', csrf: true }, false);
      if (!response.ok) {
        this.accessToken = null;
        return null;
      }
      const session = authResponseSchema.parse(await response.json());
      this.accessToken = session.accessToken;
      return session;
    } catch {
      this.accessToken = null;
      return null;
    }
  }

  private async send<T>(
    path: string,
    options: RequestOptions<T>,
    useAuth: boolean,
  ): Promise<Response> {
    const url = new URL(`${this.baseUrl}${path}`, 'http://placeholder.local');
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (useAuth && this.accessToken !== null) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    if (options.csrf === true) {
      headers[CSRF_HEADER_NAME] = readCookie(CSRF_COOKIE_NAME) ?? '';
    }
    if (options.ifMatch !== undefined) {
      headers['If-Match'] = `"v${String(options.ifMatch)}"`;
    }
    if (options.idempotencyKey !== undefined) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }
    let body: BodyInit | undefined;
    if (options.formData !== undefined) {
      body = options.formData;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
    };
    if (body !== undefined) {
      init.body = body;
    }
    if (options.signal !== undefined) {
      init.signal = options.signal;
    }
    try {
      return await this.fetchImpl(`${url.pathname}${url.search}`, init);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      throw new ApiError({ status: 0, code: 'offline', message: 'Network request failed.' });
    }
  }

  private async toError(response: Response): Promise<ApiError> {
    const retryAfter = Number(response.headers.get('retry-after'));
    const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null;
    try {
      const problem = problemSchema.parse(await response.json());
      return new ApiError({
        status: problem.status,
        code: problem.type.split('/').at(-1) ?? 'error',
        message: problem.detail,
        fieldErrors: problem.errors ?? [],
        requestId: problem.requestId,
        retryAfterSeconds,
      });
    } catch {
      return new ApiError({
        status: response.status,
        code: 'error',
        message: 'Something went wrong. Try again.',
        retryAfterSeconds,
      });
    }
  }
}

/** The one client instance used by the resource modules. */
export const api = new ApiClient();

/** A fresh key for one logical create action. Reuse it when retrying that same action. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
