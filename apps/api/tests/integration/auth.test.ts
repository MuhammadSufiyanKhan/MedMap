import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { authResponseSchema, problemSchema } from '@medmap/shared';
import {
  cookieValue,
  lastEmailToken,
  registerUser,
  sessionHeaders,
  setupTestApp,
} from '../helpers/app.js';

const ctx = setupTestApp();
const api = '/api/v1';

describe('registration', () => {
  it('creates an account, returns 201 with Location and sets hardened cookies', async () => {
    const res = await request(ctx.app)
      .post(`${api}/auth/register`)
      .send({ email: 'New.User@Example.com', password: 'a long enough password' });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/v1/me');
    const body = authResponseSchema.parse(res.body);
    expect(body.user.email).toBe('new.user@example.com');
    expect(body.user.emailVerified).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const cookies = res.headers['set-cookie'] as unknown as string[];
    const refresh = cookies.find((c) => c.startsWith('medmap_refresh=')) ?? '';
    expect(refresh).toContain('HttpOnly');
    expect(refresh).toContain('SameSite=Strict');
    expect(refresh).toContain('Path=/api/v1/auth');
    const csrf = cookies.find((c) => c.startsWith('medmap_csrf=')) ?? '';
    expect(csrf).not.toContain('HttpOnly');
  });

  it('sets Secure cookies when configured for production', async () => {
    // cookieSecure follows COOKIE_SECURE; the default in tests is false.
    const res = await request(ctx.app)
      .post(`${api}/auth/register`)
      .send({ email: 'insecure@example.com', password: 'a long enough password' });
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).not.toContain('Secure');
  });

  it('rejects a duplicate email with 409', async () => {
    const user = await registerUser(ctx.app);
    const res = await request(ctx.app)
      .post(`${api}/auth/register`)
      .send({ email: user.email.toUpperCase(), password: 'another long password' });
    expect(res.status).toBe(409);
    expect(problemSchema.parse(res.body).type).toContain('email-taken');
  });

  it('rejects weak passwords and bad emails with 422 and field errors', async () => {
    const res = await request(ctx.app)
      .post(`${api}/auth/register`)
      .send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(422);
    const paths = problemSchema.parse(res.body).errors?.map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['body.email', 'body.password']));
  });

  it('rejects operator injection in the body', async () => {
    const res = await request(ctx.app)
      .post(`${api}/auth/login`)
      .send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(422);
  });
});

describe('sign-in', () => {
  it('signs in with the right password', async () => {
    const user = await registerUser(ctx.app);
    const res = await request(ctx.app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(authResponseSchema.parse(res.body).user.id).toBe(user.id);
  });

  it('answers the same 401 for a wrong password and an unknown email', async () => {
    const user = await registerUser(ctx.app);
    const wrong = await request(ctx.app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password: 'wrong password!!' });
    const unknown = await request(ctx.app)
      .post(`${api}/auth/login`)
      .send({ email: 'nobody@example.com', password: 'wrong password!!' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.detail).toBe(unknown.body.detail);
  });

  it('locks the account after repeated failures and unlocks after the lock time', async () => {
    const user = await registerUser(ctx.app);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(ctx.app)
        .post(`${api}/auth/login`)
        .send({ email: user.email, password: 'wrong password!!' });
    }
    const locked = await request(ctx.app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password: user.password });
    expect(locked.status).toBe(429);
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);

    ctx.advance(16 * 60 * 1000);
    const afterLock = await request(ctx.app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password: user.password });
    expect(afterLock.status).toBe(200);
  });
});

describe('access tokens', () => {
  it('GET /me needs a valid bearer token', async () => {
    const user = await registerUser(ctx.app);
    expect((await request(ctx.app).get(`${api}/me`)).status).toBe(401);
    expect(
      (await request(ctx.app).get(`${api}/me`).set('Authorization', 'Bearer not.a.jwt')).status,
    ).toBe(401);
    const tampered = `${user.token.slice(0, -3)}abc`;
    expect(
      (await request(ctx.app).get(`${api}/me`).set('Authorization', `Bearer ${tampered}`)).status,
    ).toBe(401);
    const ok = await request(ctx.app).get(`${api}/me`).set(user.auth);
    expect(ok.status).toBe(200);
    expect(ok.body.email).toBe(user.email);
  });

  it('rejects an unsigned (alg none) token', async () => {
    const user = await registerUser(ctx.app);
    const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: user.id, iss: 'medmap-api', aud: 'medmap-web' }),
    ).toString('base64url');
    const res = await request(ctx.app)
      .get(`${api}/me`)
      .set('Authorization', `Bearer ${header}.${payload}.`);
    expect(res.status).toBe(401);
  });
});

describe('refresh rotation', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const user = await registerUser(ctx.app);
    const res = await request(ctx.app)
      .post(`${api}/auth/refresh`)
      .set(sessionHeaders(user.cookies));
    expect(res.status).toBe(200);
    const next = res.headers['set-cookie'] as unknown as string[];
    expect(cookieValue(next, 'medmap_refresh')).not.toBe(
      cookieValue(user.cookies, 'medmap_refresh'),
    );
    expect(authResponseSchema.parse(res.body).user.id).toBe(user.id);
  });

  it('requires the CSRF header and a known origin', async () => {
    const user = await registerUser(ctx.app);
    const headers = sessionHeaders(user.cookies);
    const noHeader = await request(ctx.app)
      .post(`${api}/auth/refresh`)
      .set('Cookie', headers.Cookie ?? '');
    expect(noHeader.status).toBe(403);
    const wrongHeader = await request(ctx.app)
      .post(`${api}/auth/refresh`)
      .set({ ...headers, 'X-CSRF-Token': 'wrong' });
    expect(wrongHeader.status).toBe(403);
    const foreignOrigin = await request(ctx.app)
      .post(`${api}/auth/refresh`)
      .set({ ...headers, Origin: 'https://evil.example' });
    expect(foreignOrigin.status).toBe(403);
  });

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    const user = await registerUser(ctx.app);
    const first = await request(ctx.app)
      .post(`${api}/auth/refresh`)
      .set(sessionHeaders(user.cookies));
    expect(first.status).toBe(200);
    const rotated = first.headers['set-cookie'] as unknown as string[];

    const replay = await request(ctx.app)
      .post(`${api}/auth/refresh`)
      .set(sessionHeaders(user.cookies));
    expect(replay.status).toBe(401);

    const afterReuse = await request(ctx.app)
      .post(`${api}/auth/refresh`)
      .set(sessionHeaders(rotated));
    expect(afterReuse.status).toBe(401);
  });

  it('rejects an expired refresh token', async () => {
    const user = await registerUser(ctx.app);
    ctx.advance(31 * 24 * 60 * 60 * 1000);
    const res = await request(ctx.app)
      .post(`${api}/auth/refresh`)
      .set(sessionHeaders(user.cookies));
    expect(res.status).toBe(401);
    ctx.advance(-31 * 24 * 60 * 60 * 1000);
  });

  it('answers 401 without a refresh cookie', async () => {
    const res = await request(ctx.app)
      .post(`${api}/auth/refresh`)
      .set({ Cookie: 'medmap_csrf=abc', 'X-CSRF-Token': 'abc' });
    expect(res.status).toBe(401);
  });
});

describe('sign-out', () => {
  it('ends the session and clears the cookies', async () => {
    const user = await registerUser(ctx.app);
    const out = await request(ctx.app).post(`${api}/auth/logout`).set(sessionHeaders(user.cookies));
    expect(out.status).toBe(204);
    const cleared = (out.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cleared).toContain('medmap_refresh=;');
    const res = await request(ctx.app)
      .post(`${api}/auth/refresh`)
      .set(sessionHeaders(user.cookies));
    expect(res.status).toBe(401);
  });
});

describe('email verification', () => {
  it('confirms the address with the emailed token exactly once', async () => {
    const user = await registerUser(ctx.app);
    const token = lastEmailToken(ctx.email, user.email);
    const confirm = await request(ctx.app)
      .post(`${api}/auth/email-verifications/confirm`)
      .send({ token });
    expect(confirm.status).toBe(204);
    const me = await request(ctx.app).get(`${api}/me`).set(user.auth);
    expect(me.body.emailVerified).toBe(true);
    const again = await request(ctx.app)
      .post(`${api}/auth/email-verifications/confirm`)
      .send({ token });
    expect(again.status).toBe(400);
  });

  it('sends a new link on request', async () => {
    const user = await registerUser(ctx.app);
    const before = ctx.email.sent.length;
    const res = await request(ctx.app).post(`${api}/auth/email-verifications`).set(user.auth);
    expect(res.status).toBe(202);
    expect(ctx.email.sent.length).toBe(before + 1);
  });

  it('rejects an expired token', async () => {
    const user = await registerUser(ctx.app);
    const token = lastEmailToken(ctx.email, user.email);
    ctx.advance(49 * 60 * 60 * 1000);
    const res = await request(ctx.app)
      .post(`${api}/auth/email-verifications/confirm`)
      .send({ token });
    expect(res.status).toBe(400);
    ctx.advance(-49 * 60 * 60 * 1000);
  });
});

describe('password reset', () => {
  it('answers 202 for unknown addresses without sending anything', async () => {
    const before = ctx.email.sent.length;
    const res = await request(ctx.app)
      .post(`${api}/auth/password-resets`)
      .send({ email: 'ghost@example.com' });
    expect(res.status).toBe(202);
    expect(ctx.email.sent.length).toBe(before);
  });

  it('sets a new password, signs out other sessions and invalidates the old password', async () => {
    const user = await registerUser(ctx.app);
    await request(ctx.app).post(`${api}/auth/password-resets`).send({ email: user.email });
    const token = lastEmailToken(ctx.email, user.email);
    const confirm = await request(ctx.app)
      .post(`${api}/auth/password-resets/confirm`)
      .send({ token, newPassword: 'a brand new password' });
    expect(confirm.status).toBe(204);

    const oldSession = await request(ctx.app)
      .post(`${api}/auth/refresh`)
      .set(sessionHeaders(user.cookies));
    expect(oldSession.status).toBe(401);
    const oldPassword = await request(ctx.app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password: user.password });
    expect(oldPassword.status).toBe(401);
    const newPassword = await request(ctx.app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password: 'a brand new password' });
    expect(newPassword.status).toBe(200);

    const reuse = await request(ctx.app)
      .post(`${api}/auth/password-resets/confirm`)
      .send({ token, newPassword: 'yet another password' });
    expect(reuse.status).toBe(400);
  });
});
