import { randomBytes } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll } from 'vitest';
import type { AuthResponse } from '@medmap/shared';
import { createContainer } from '../../src/container.js';
import type { ContainerOverrides } from '../../src/container.js';
import { MemoryEmailAdapter } from '../../src/integrations/email/email.js';
import {
  connectDatabase,
  disconnectDatabase,
  dropTestDatabase,
  ensureIndexes,
} from '../../src/repositories/db.js';
import type { AnyRouteSpec } from '../../src/utils/http.js';
import { createLogger } from '../../src/utils/logger.js';
import { testConfig } from './config.js';

export interface TestContext {
  app: Express;
  routes: AnyRouteSpec[];
  email: MemoryEmailAdapter;
  /** Moves the application clock forward. */
  advance(ms: number): void;
  now(): Date;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  token: string;
  /** Raw Set-Cookie headers from sign-in. */
  cookies: string[];
  auth: { Authorization: string };
}

/**
 * Boots the real app against a throwaway database for one test file. The database is
 * created with a unique name and dropped afterwards, so files can run in parallel.
 */
export function setupTestApp(
  envOverrides: Record<string, string | undefined> = {},
  containerOverrides: (ctx: { email: MemoryEmailAdapter }) => ContainerOverrides = () => ({}),
): TestContext {
  let offset = 0;
  const email = new MemoryEmailAdapter();
  const ctx: TestContext = {
    app: undefined as unknown as Express,
    routes: [],
    email,
    advance(ms) {
      offset += ms;
    },
    now() {
      return new Date(Date.now() + offset);
    },
  };

  beforeAll(async () => {
    const base = process.env.MONGO_TEST_URI;
    if (base === undefined) {
      throw new Error('MONGO_TEST_URI was not set by the global setup');
    }
    const dbName = `medmap_test_${randomBytes(6).toString('hex')}`;
    const uri = `${base.replace(/\/+$/, '')}/${dbName}`;
    await connectDatabase(uri, { autoIndex: false });
    await ensureIndexes();
    const config = testConfig({ MONGODB_URI: uri, ...envOverrides });
    const container = createContainer(config, createLogger({ level: 'silent', pretty: false }), {
      clock: () => ctx.now(),
      email,
      ...containerOverrides({ email }),
    });
    ctx.app = container.app;
    ctx.routes = container.routes;
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectDatabase();
  });

  return ctx;
}

let counter = 0;

/** Registers a fresh user and returns everything a test needs to act as them. */
export async function registerUser(app: Express, emailPrefix = 'user'): Promise<TestUser> {
  counter += 1;
  const email = `${emailPrefix}-${String(counter)}-${randomBytes(3).toString('hex')}@example.com`;
  const password = 'correct horse battery';
  const res = await request(app).post('/api/v1/auth/register').send({ email, password });
  if (res.status !== 201) {
    throw new Error(`register failed: ${String(res.status)} ${JSON.stringify(res.body)}`);
  }
  const body = res.body as AuthResponse;
  const cookies = res.headers['set-cookie'] as unknown as string[];
  return {
    id: body.user.id,
    email,
    password,
    token: body.accessToken,
    cookies,
    auth: { Authorization: `Bearer ${body.accessToken}` },
  };
}

/** Extracts `name=value` for one cookie from Set-Cookie headers. */
export function cookieValue(cookies: string[], name: string): string {
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (match === undefined) {
    throw new Error(`cookie ${name} was not set`);
  }
  return (match.split(';')[0] ?? '').slice(name.length + 1);
}

/** Headers for a cookie-authenticated call (refresh, logout) including the CSRF header. */
export function sessionHeaders(cookies: string[]): Record<string, string> {
  return {
    Cookie: cookies.map((cookie) => cookie.split(';')[0]).join('; '),
    'X-CSRF-Token': cookieValue(cookies, 'medmap_csrf'),
  };
}

/** Finds the token in the most recent email whose link path matches. */
export function lastEmailToken(email: MemoryEmailAdapter, to: string): string {
  const message = email.sent.findLast((item) => item.to === to);
  const token = message ? /token=([A-Za-z0-9_-]+)/.exec(message.text)?.[1] : undefined;
  if (token === undefined) {
    throw new Error(`no email with a token was sent to ${to}`);
  }
  return token;
}

export async function createProfile(
  app: Express,
  user: TestUser,
  displayName = 'Mum',
): Promise<{ id: string; etag: string }> {
  const res = await request(app).post('/api/v1/profiles').set(user.auth).send({ displayName });
  if (res.status !== 201) {
    throw new Error(`create profile failed: ${String(res.status)}`);
  }
  return { id: (res.body as { id: string }).id, etag: res.headers.etag ?? '' };
}

/** Invites `invitee` to the profile with a role and accepts the invite as them. */
export async function shareProfile(
  app: Express,
  owner: TestUser,
  profileId: string,
  invitee: TestUser,
  role: 'caregiver' | 'viewer',
): Promise<void> {
  const invite = await request(app)
    .post(`/api/v1/profiles/${profileId}/invites`)
    .set(owner.auth)
    .send({ email: invitee.email, role });
  if (invite.status !== 201) {
    throw new Error(`invite failed: ${String(invite.status)}`);
  }
  const accept = await request(app)
    .post('/api/v1/invite-acceptances')
    .set(invitee.auth)
    .send({ token: (invite.body as { token: string }).token });
  if (accept.status !== 201) {
    throw new Error(`accept failed: ${String(accept.status)}`);
  }
}
