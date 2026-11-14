import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError } from '../src/domain/errors';
import { ApiClient, newIdempotencyKey } from '../src/services/http';
import type { FetchLike } from '../src/services/http';

const user = {
  id: 'a'.repeat(24),
  email: 'a@example.com',
  emailVerified: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};
const session = { accessToken: 'token-2', expiresIn: 900, user };

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function problem(status: number, code: string, extra: object = {}): Response {
  return json(status, {
    type: `https://medmap.example/problems/${code}`,
    title: 'Error',
    status,
    detail: `detail for ${code}`,
    requestId: 'req-1',
    ...extra,
  });
}

function setCsrfCookie(): void {
  document.cookie = 'medmap_csrf=csrf-value; path=/';
}

afterEach(() => {
  document.cookie = 'medmap_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

describe('ApiClient', () => {
  it('sends JSON with the bearer token, If-Match and Idempotency-Key, and parses the body and ETag', async () => {
    const fetchMock = vi.fn<FetchLike>(() =>
      Promise.resolve(json(200, { ok: true }, { ETag: '"v7"' })),
    );
    const client = new ApiClient(fetchMock);
    client.setAccessToken('token-1');
    const result = await client.request('/things/1', {
      method: 'PATCH',
      body: { a: 1 },
      query: { limit: 5, cursor: undefined, empty: '' },
      schema: z.object({ ok: z.boolean() }),
      ifMatch: 6,
      idempotencyKey: 'key-1',
    });
    expect(result).toEqual({ data: { ok: true }, version: 7 });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/things/1?limit=5');
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-1');
    expect(headers['If-Match']).toBe('"v6"');
    expect(headers['Idempotency-Key']).toBe('key-1');
    expect(headers['Content-Type']).toBe('application/json');
    expect(init?.credentials).toBe('same-origin');
    expect(init?.cache).toBe('no-store');
  });

  it('returns undefined data for 204 and for calls without a schema', async () => {
    const client = new ApiClient(() => Promise.resolve(json(204, null)));
    expect(await client.request('/x', { method: 'DELETE' })).toEqual({
      data: undefined,
      version: null,
    });
  });

  it('maps problem documents to ApiError with field errors and Retry-After', async () => {
    const client = new ApiClient(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            type: 'https://medmap.example/problems/too-many-requests',
            title: 'Too many requests',
            status: 429,
            detail: 'Slow down.',
            requestId: 'req-9',
            errors: [{ path: 'body.email', message: 'bad' }],
          }),
          { status: 429, headers: { 'Retry-After': '120' } },
        ),
      ),
    );
    const error = await client.request('/x').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 429,
      code: 'too-many-requests',
      message: 'Slow down.',
      requestId: 'req-9',
      retryAfterSeconds: 120,
    });
    expect((error as ApiError).fieldErrors).toEqual([{ path: 'body.email', message: 'bad' }]);
  });

  it('falls back to a generic error for non-problem responses', async () => {
    const client = new ApiClient(() =>
      Promise.resolve(new Response('<html>bad gateway</html>', { status: 502 })),
    );
    await expect(client.request('/x')).rejects.toMatchObject({ status: 502, code: 'error' });
  });

  it('reports network failures as offline', async () => {
    const client = new ApiClient(() => Promise.reject(new TypeError('Failed to fetch')));
    const error = (await client.request('/x').catch((caught: unknown) => caught)) as ApiError;
    expect(error.isOffline).toBe(true);
  });

  it('lets an abort through unchanged', async () => {
    const client = new ApiClient(() => Promise.reject(new DOMException('Aborted', 'AbortError')));
    await expect(client.request('/x')).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects a success body that does not match the schema', async () => {
    const client = new ApiClient(() => Promise.resolve(json(200, { unexpected: true })));
    await expect(
      client.request('/x', { schema: z.object({ ok: z.boolean() }) }),
    ).rejects.toMatchObject({
      code: 'unexpected-response',
    });
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    setCsrfCookie();
    const calls: { url: string; auth: string | undefined; csrf: string | undefined }[] = [];
    const fetchMock: FetchLike = (url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url, auth: headers.Authorization, csrf: headers['x-csrf-token'] });
      if (url === '/api/v1/auth/refresh') {
        return Promise.resolve(json(200, session));
      }
      return Promise.resolve(
        headers.Authorization === 'Bearer token-2'
          ? json(200, { ok: true })
          : problem(401, 'invalid-token'),
      );
    };
    const client = new ApiClient(fetchMock);
    client.setAccessToken('expired');
    const result = await client.request('/me', { schema: z.object({ ok: z.boolean() }) });
    expect(result.data).toEqual({ ok: true });
    expect(calls.map((call) => call.url)).toEqual([
      '/api/v1/me',
      '/api/v1/auth/refresh',
      '/api/v1/me',
    ]);
    expect(calls[1]).toMatchObject({ auth: undefined, csrf: 'csrf-value' });
  });

  it('shares one refresh between concurrent callers', async () => {
    setCsrfCookie();
    let refreshes = 0;
    const client = new ApiClient((url) => {
      if (url === '/api/v1/auth/refresh') {
        refreshes += 1;
        return new Promise((resolve) =>
          setTimeout(() => {
            resolve(json(200, session));
          }, 5),
        );
      }
      return Promise.resolve(json(200, {}));
    });
    const [a, b] = await Promise.all([client.refresh(), client.refresh()]);
    expect(refreshes).toBe(1);
    expect(a).toEqual(b);
    expect(client.hasAccessToken()).toBe(true);
  });

  it('signals a lost session when the refresh fails, and surfaces the 401', async () => {
    setCsrfCookie();
    const lost = vi.fn();
    const client = new ApiClient(() => Promise.resolve(problem(401, 'invalid-refresh')));
    client.setSessionLostHandler(lost);
    client.setAccessToken('expired');
    await expect(client.request('/me')).rejects.toMatchObject({ status: 401 });
    expect(lost).toHaveBeenCalledOnce();
    expect(client.hasAccessToken()).toBe(false);
  });

  it('does not try to refresh without a session cookie or on public calls', async () => {
    const fetchMock = vi.fn<FetchLike>(() => Promise.resolve(problem(401, 'unauthorized')));
    const client = new ApiClient(fetchMock);
    await expect(client.request('/me')).rejects.toMatchObject({ status: 401 });
    expect(await client.refresh()).toBeNull();
    setCsrfCookie();
    await expect(
      client.request('/auth/login', { method: 'POST', auth: false }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/me',
      '/api/v1/auth/login',
    ]);
  });

  it('treats a refresh that throws as no session', async () => {
    setCsrfCookie();
    const client = new ApiClient(() => Promise.reject(new TypeError('offline')));
    expect(await client.refresh()).toBeNull();
  });

  it('sends form data without a JSON content type', async () => {
    const fetchMock = vi.fn<FetchLike>(() => Promise.resolve(json(200, {})));
    const form = new FormData();
    form.append('images', new Blob(['x']), 'a.jpg');
    await new ApiClient(fetchMock).request('/upload', { method: 'POST', formData: form });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBe(form);
    expect((init?.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('creates distinct idempotency keys', () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});
