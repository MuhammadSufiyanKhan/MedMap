import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { problemSchema } from '@medmap/shared';
import { buildApp } from '../../src/app.js';
import { UnauthorizedError } from '../../src/utils/errors.js';
import { defineRoute } from '../../src/utils/http.js';
import { createLogger } from '../../src/utils/logger.js';
import { testConfig } from '../helpers/config.js';

function appWith(overrides: Record<string, string | undefined> = {}, mongoOk = true) {
  return buildApp({
    config: testConfig(overrides),
    logger: createLogger({ level: 'silent', pretty: false }),
    routes: [
      defineRoute({
        method: 'post',
        path: '/echo',
        summary: 'Echo',
        tag: 'Test',
        auth: 'public',
        body: z.strictObject({ name: z.string().min(2) }),
        responses: { 200: { description: 'ok', schema: z.object({ name: z.string() }) } },
        handler: (ctx) =>
          Promise.resolve({ status: 200, body: { name: ctx.body.name, secret: 'stripped' } }),
      }),
      defineRoute({
        method: 'get',
        path: '/boom',
        summary: 'Fails',
        tag: 'Test',
        auth: 'public',
        responses: { 200: { description: 'never' } },
        handler: () => Promise.reject(new Error('database password is hunter2')),
      }),
      defineRoute({
        method: 'get',
        path: '/private',
        summary: 'Private',
        tag: 'Test',
        responses: { 200: { description: 'ok' } },
        handler: () => Promise.resolve({ status: 200, body: {} }),
      }),
    ],
    verifyAccessToken: () => {
      throw new UnauthorizedError();
    },
    idempotency: {
      begin: () => Promise.resolve(null),
      complete: () => Promise.resolve(),
      abandon: () => Promise.resolve(),
    },
    multipart: (_req, _res, next) => {
      next();
    },
    pingDatabase: () => Promise.resolve(mongoOk),
    version: '0.0.0-test',
  });
}

describe('health endpoints', () => {
  it('GET /healthz answers 200 without touching the database', async () => {
    const res = await request(appWith({}, false)).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /readyz reflects the database state', async () => {
    expect((await request(appWith()).get('/readyz')).status).toBe(200);
    const down = await request(appWith({}, false)).get('/readyz');
    expect(down.status).toBe(503);
    expect(down.body).toEqual({ status: 'unavailable', checks: { mongo: 'unavailable' } });
  });
});

describe('HTTP conventions', () => {
  it('returns problem+json with a request id for unknown routes', async () => {
    const res = await request(appWith()).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const problem = problemSchema.parse(res.body);
    expect(problem.requestId).toBe(res.headers['x-request-id']);
  });

  it('reuses a well-formed incoming request id and ignores a hostile one', async () => {
    const ok = await request(appWith()).get('/healthz').set('X-Request-Id', 'abc-12345678');
    expect(ok.headers['x-request-id']).toBe('abc-12345678');
    const bad = await request(appWith())
      .get('/healthz')
      .set('X-Request-Id', '<script>injected</script>');
    expect(bad.headers['x-request-id']).not.toContain('injected');
  });

  it('answers 422 with field errors for invalid bodies and unknown keys', async () => {
    const res = await request(appWith())
      .post('/api/v1/echo')
      .send({ name: 'a', extra: { $gt: '' } });
    expect(res.status).toBe(422);
    const problem = problemSchema.parse(res.body);
    expect(problem.errors?.map((e) => e.path)).toContain('body.name');
  });

  it('answers 400 for malformed JSON and 415 for non-JSON bodies', async () => {
    const malformed = await request(appWith())
      .post('/api/v1/echo')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(malformed.status).toBe(400);
    const wrongType = await request(appWith())
      .post('/api/v1/echo')
      .set('Content-Type', 'text/plain')
      .send('name=abc');
    expect(wrongType.status).toBe(415);
  });

  it('answers 413 for oversized JSON bodies', async () => {
    const res = await request(appWith())
      .post('/api/v1/echo')
      .send({ name: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('strips undocumented fields from responses and sends no-store', async () => {
    const res = await request(appWith()).post('/api/v1/echo').send({ name: 'abc' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'abc' });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers).toHaveProperty('ratelimit');
  });

  it('never leaks internals from unexpected errors', async () => {
    const res = await request(appWith({ NODE_ENV: 'production' })).get('/api/v1/boom');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(JSON.stringify(res.body)).not.toContain('at ');
  });

  it('answers 401 with WWW-Authenticate on protected routes', async () => {
    const res = await request(appWith()).get('/api/v1/private');
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });

  it('answers 429 with Retry-After once the limit is hit', async () => {
    const app = appWith({ RATE_LIMIT_GENERAL_MAX: '2' });
    await request(app).get('/api/v1/boom');
    await request(app).get('/api/v1/boom');
    const res = await request(app).get('/api/v1/boom');
    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('serves API docs outside production only', async () => {
    const dev = await request(appWith()).get('/api/docs/openapi.json');
    expect(dev.status).toBe(200);
    expect(dev.body.openapi).toBe('3.1.0');
    expect(dev.body.paths['/api/v1/echo'].post.requestBody).toBeDefined();
    const prod = await request(appWith({ NODE_ENV: 'production' })).get('/api/docs/openapi.json');
    expect(prod.status).toBe(404);
  });

  it('sets security headers', async () => {
    const res = await request(appWith()).get('/api/v1/nope');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
