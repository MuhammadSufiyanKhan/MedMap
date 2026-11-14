import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { profilePageSchema, profileSchema, problemSchema } from '@medmap/shared';
import { createProfile, registerUser, setupTestApp } from '../helpers/app.js';

const ctx = setupTestApp();
const api = '/api/v1';

describe('profiles CRUD', () => {
  it('creates a profile with 201, Location and ETag, and makes the creator owner', async () => {
    const user = await registerUser(ctx.app);
    const res = await request(ctx.app)
      .post(`${api}/profiles`)
      .set(user.auth)
      .send({ displayName: ' Mum ', birthYear: 1941, notes: 'Lives alone' });
    expect(res.status).toBe(201);
    const profile = profileSchema.parse(res.body);
    expect(profile.displayName).toBe('Mum');
    expect(profile.role).toBe('owner');
    expect(profile.activeMedicationCount).toBe(0);
    expect(res.headers.location).toBe(`/api/v1/profiles/${profile.id}`);
    expect(res.headers.etag).toBe('"v1"');
  });

  it('ignores an ownerId sent by the client', async () => {
    const user = await registerUser(ctx.app);
    const res = await request(ctx.app)
      .post(`${api}/profiles`)
      .set(user.auth)
      .send({ displayName: 'Dad', ownerId: 'a'.repeat(24) });
    expect(res.status).toBe(422);
  });

  it('lists only profiles the user belongs to, with cursor pagination', async () => {
    const user = await registerUser(ctx.app);
    const other = await registerUser(ctx.app);
    await createProfile(ctx.app, other, 'Not mine');
    for (const name of ['A', 'B', 'C']) {
      await createProfile(ctx.app, user, name);
    }
    const first = await request(ctx.app).get(`${api}/profiles?limit=2`).set(user.auth);
    expect(first.status).toBe(200);
    const page1 = profilePageSchema.parse(first.body);
    expect(page1.items.map((p) => p.displayName)).toEqual(['C', 'B']);
    expect(page1.nextCursor).not.toBeNull();

    const second = await request(ctx.app)
      .get(`${api}/profiles?limit=2&cursor=${encodeURIComponent(page1.nextCursor ?? '')}`)
      .set(user.auth);
    const page2 = profilePageSchema.parse(second.body);
    expect(page2.items.map((p) => p.displayName)).toEqual(['A']);
    expect(page2.nextCursor).toBeNull();
  });

  it('validates list parameters', async () => {
    const user = await registerUser(ctx.app);
    expect((await request(ctx.app).get(`${api}/profiles?limit=101`).set(user.auth)).status).toBe(
      422,
    );
    expect(
      (await request(ctx.app).get(`${api}/profiles?cursor=garbage`).set(user.auth)).status,
    ).toBe(400);
    expect((await request(ctx.app).get(`${api}/profiles?sort=email`).set(user.auth)).status).toBe(
      422,
    );
  });

  it('gets one profile with its ETag', async () => {
    const user = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, user);
    const res = await request(ctx.app).get(`${api}/profiles/${id}`).set(user.auth);
    expect(res.status).toBe(200);
    expect(res.headers.etag).toBe('"v1"');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('answers 422 for a malformed id and 404 for an unknown one', async () => {
    const user = await registerUser(ctx.app);
    expect((await request(ctx.app).get(`${api}/profiles/not-an-id`).set(user.auth)).status).toBe(
      422,
    );
    expect(
      (
        await request(ctx.app)
          .get(`${api}/profiles/${'f'.repeat(24)}`)
          .set(user.auth)
      ).status,
    ).toBe(404);
  });
});

describe('optimistic concurrency', () => {
  it('requires If-Match (428), rejects foreign ETags (400) and stale ones (412)', async () => {
    const user = await registerUser(ctx.app);
    const { id, etag } = await createProfile(ctx.app, user);
    const url = `${api}/profiles/${id}`;

    const missing = await request(ctx.app).patch(url).set(user.auth).send({ displayName: 'X' });
    expect(missing.status).toBe(428);

    const foreign = await request(ctx.app)
      .patch(url)
      .set(user.auth)
      .set('If-Match', 'W/"abc"')
      .send({ displayName: 'X' });
    expect(foreign.status).toBe(400);

    const ok = await request(ctx.app)
      .patch(url)
      .set(user.auth)
      .set('If-Match', etag)
      .send({ displayName: 'Mother', notes: null });
    expect(ok.status).toBe(200);
    expect(ok.headers.etag).toBe('"v2"');
    expect(ok.body.displayName).toBe('Mother');

    const stale = await request(ctx.app)
      .patch(url)
      .set(user.auth)
      .set('If-Match', etag)
      .send({ displayName: 'Lost update' });
    expect(stale.status).toBe(412);
    expect(problemSchema.parse(stale.body).type).toContain('precondition-failed');
  });

  it('rejects an empty patch', async () => {
    const user = await registerUser(ctx.app);
    const { id, etag } = await createProfile(ctx.app, user);
    const res = await request(ctx.app)
      .patch(`${api}/profiles/${id}`)
      .set(user.auth)
      .set('If-Match', etag)
      .send({});
    expect(res.status).toBe(422);
  });
});

describe('idempotency', () => {
  it('replays the first response for a repeated key and creates one profile', async () => {
    const user = await registerUser(ctx.app);
    const send = () =>
      request(ctx.app)
        .post(`${api}/profiles`)
        .set(user.auth)
        .set('Idempotency-Key', 'aaaa-aaaa-0001')
        .send({ displayName: 'Once' });
    const first = await send();
    const second = await send();
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.headers.location).toBe(first.headers.location);
    const list = await request(ctx.app).get(`${api}/profiles`).set(user.auth);
    expect(list.body.items).toHaveLength(1);
  });

  it('answers 409 when a key is reused for a different request', async () => {
    const user = await registerUser(ctx.app);
    const post = (displayName: string) =>
      request(ctx.app)
        .post(`${api}/profiles`)
        .set(user.auth)
        .set('Idempotency-Key', 'aaaa-aaaa-0002')
        .send({ displayName });
    expect((await post('One')).status).toBe(201);
    expect((await post('Two')).status).toBe(409);
  });

  it('scopes keys per user and rejects malformed keys', async () => {
    const a = await registerUser(ctx.app);
    const b = await registerUser(ctx.app);
    const post = (auth: { Authorization: string }, key: string) =>
      request(ctx.app)
        .post(`${api}/profiles`)
        .set(auth)
        .set('Idempotency-Key', key)
        .send({ displayName: 'Shared key' });
    const first = await post(a.auth, 'aaaa-aaaa-0003');
    const second = await post(b.auth, 'aaaa-aaaa-0003');
    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);
    expect((await post(a.auth, 'bad key!')).status).toBe(400);
  });

  it('frees the key when the request fails, so a corrected retry works', async () => {
    const user = await registerUser(ctx.app);
    const bad = await request(ctx.app)
      .post(`${api}/profiles`)
      .set(user.auth)
      .set('Idempotency-Key', 'aaaa-aaaa-0004')
      .send({ displayName: '' });
    expect(bad.status).toBe(422);
    const good = await request(ctx.app)
      .post(`${api}/profiles`)
      .set(user.auth)
      .set('Idempotency-Key', 'aaaa-aaaa-0004')
      .send({ displayName: 'Fixed' });
    expect(good.status).toBe(201);
  });
});

describe('deleting a profile', () => {
  it('deletes with 204 and then answers 404', async () => {
    const user = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, user);
    expect((await request(ctx.app).delete(`${api}/profiles/${id}`).set(user.auth)).status).toBe(
      204,
    );
    expect((await request(ctx.app).get(`${api}/profiles/${id}`).set(user.auth)).status).toBe(404);
  });
});

describe('limits', () => {
  it('caps the number of profiles per user', async () => {
    const user = await registerUser(ctx.app);
    for (let i = 0; i < 20; i += 1) {
      await createProfile(ctx.app, user, `P${String(i)}`);
    }
    const res = await request(ctx.app)
      .post(`${api}/profiles`)
      .set(user.auth)
      .send({ displayName: 'One too many' });
    expect(res.status).toBe(409);
  });
});
