import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  auditLogPageSchema,
  medicationPageSchema,
  medicationSchema,
  normalizeResponseSchema,
} from '@medmap/shared';
import type { DrugNormalizer } from '../../src/integrations/rxnorm/normalizer.js';
import { ServiceUnavailableError } from '../../src/utils/errors.js';
import {
  addMedication,
  createProfile,
  registerUser,
  seedDemoDataset,
  setupTestApp,
  shareProfile,
} from '../helpers/app.js';

/** Stands in for RxNorm: knows one real-looking concept and can be switched to "down". */
const fakeRxNorm: DrugNormalizer & { down: boolean; calls: number } = {
  name: 'Fake RxNorm',
  down: false,
  calls: 0,
  search(term) {
    this.calls += 1;
    if (this.down) {
      return Promise.reject(new ServiceUnavailableError('lookup down', 'name-lookup-unavailable'));
    }
    return Promise.resolve(
      term.toLowerCase().includes('aspirin')
        ? [
            {
              rxcui: '1191',
              name: 'aspirin',
              termType: 'IN',
              ingredients: [{ rxcui: '1191', name: 'aspirin' }],
              score: null,
            },
          ]
        : [],
    );
  },
  resolve(rxcui) {
    if (this.down) {
      return Promise.reject(new ServiceUnavailableError('lookup down', 'name-lookup-unavailable'));
    }
    return Promise.resolve(
      rxcui === '1191'
        ? { rxcui, name: 'aspirin', termType: 'IN', ingredients: [{ rxcui, name: 'aspirin' }] }
        : null,
    );
  },
};

const ctx = setupTestApp({}, () => ({ drugNormalizer: fakeRxNorm }));
const api = '/api/v1';

beforeAll(async () => {
  await seedDemoDataset(ctx);
});

describe('name lookup', () => {
  it('needs sign-in and a term of at least two characters', async () => {
    const user = await registerUser(ctx.app);
    expect((await request(ctx.app).get(`${api}/drugs/normalize?term=demolol`)).status).toBe(401);
    expect(
      (await request(ctx.app).get(`${api}/drugs/normalize?term=a`).set(user.auth)).status,
    ).toBe(422);
    expect((await request(ctx.app).get(`${api}/drugs/normalize`).set(user.auth)).status).toBe(422);
  });

  it('finds demo names while the demo dataset is active and names its source', async () => {
    const user = await registerUser(ctx.app);
    const res = await request(ctx.app).get(`${api}/drugs/normalize?term=Demolol`).set(user.auth);
    expect(res.status).toBe(200);
    const body = normalizeResponseSchema.parse(res.body);
    expect(body.candidates[0]).toMatchObject({ rxcui: 'DEMO-0001', name: 'Demolol' });
    expect(body.source).toContain('MedMap demo names');
  });

  it('caches results so the lookup service is called once per term', async () => {
    const user = await registerUser(ctx.app);
    const before = fakeRxNorm.calls;
    await request(ctx.app).get(`${api}/drugs/normalize?term=Aspirin%20cache`).set(user.auth);
    await request(ctx.app).get(`${api}/drugs/normalize?term=aspirin%20CACHE`).set(user.auth);
    expect(fakeRxNorm.calls).toBe(before + 1);
  });

  it('answers 503 problem+json when the lookup service is down', async () => {
    const user = await registerUser(ctx.app);
    fakeRxNorm.down = true;
    const res = await request(ctx.app).get(`${api}/drugs/normalize?term=newterm`).set(user.auth);
    fakeRxNorm.down = false;
    expect(res.status).toBe(503);
    expect(res.body.type).toContain('name-lookup-unavailable');
  });
});

describe('medicines CRUD', () => {
  it('creates a medicine and derives ingredients on the server', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    const res = await request(ctx.app)
      .post(`${api}/profiles/${profileId}/medications`)
      .set(user.auth)
      .send({
        displayName: 'Duoflex',
        rxcui: 'DEMO-0102',
        strengthText: '5 mg / 10 mg',
        kind: 'prescription',
      });
    expect(res.status).toBe(201);
    const medication = medicationSchema.parse(res.body);
    expect(medication.ingredientRxcuis).toEqual(['DEMO-0002', 'DEMO-0003']);
    expect(medication.ingredientNames).toEqual(['Samplifen', 'Testazole']);
    expect(medication.status).toBe('active');
    expect(medication.source).toBe('manual');
    expect(res.headers.location).toBe(`/api/v1/profiles/${profileId}/medications/${medication.id}`);
    expect(res.headers.etag).toBe('"v1"');
  });

  it('refuses client-supplied ingredients and unknown concept ids', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    const url = `${api}/profiles/${profileId}/medications`;
    const injected = await request(ctx.app)
      .post(url)
      .set(user.auth)
      .send({ displayName: 'X', ingredientRxcuis: ['DEMO-0001'] });
    expect(injected.status).toBe(422);
    const unknown = await request(ctx.app)
      .post(url)
      .set(user.auth)
      .send({ displayName: 'X', rxcui: '424242' });
    expect(unknown.status).toBe(422);
    expect(unknown.body.errors[0].path).toBe('body.rxcui');
    const malformed = await request(ctx.app)
      .post(url)
      .set(user.auth)
      .send({ displayName: 'X', rxcui: { $ne: null } });
    expect(malformed.status).toBe(422);
  });

  it('saves a medicine without a match so it shows as "could not check"', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    const res = await request(ctx.app)
      .post(`${api}/profiles/${profileId}/medications`)
      .set(user.auth)
      .send({ displayName: 'Blue tablets from the market', kind: 'supplement', source: 'label' });
    expect(res.status).toBe(201);
    expect(res.body.rxcui).toBeNull();
    expect(res.body.ingredientRxcuis).toEqual([]);
  });

  it('passes a lookup outage through as 503 so the client can save without a match', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    fakeRxNorm.down = true;
    const res = await request(ctx.app)
      .post(`${api}/profiles/${profileId}/medications`)
      .set(user.auth)
      .send({ displayName: 'Aspirin', rxcui: '4242' });
    fakeRxNorm.down = false;
    expect(res.status).toBe(503);
  });

  it('lists with status filter, whitelisted sort and cursor pagination', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    for (const displayName of ['Cherry', 'Apple', 'Banana']) {
      await addMedication(ctx.app, user, profileId, { displayName });
    }
    const url = `${api}/profiles/${profileId}/medications`;
    const newest = medicationPageSchema.parse(
      (await request(ctx.app).get(url).set(user.auth)).body,
    );
    expect(newest.items.map((m) => m.displayName)).toEqual(['Banana', 'Apple', 'Cherry']);

    const page1 = medicationPageSchema.parse(
      (await request(ctx.app).get(`${url}?sort=displayName&limit=2`).set(user.auth)).body,
    );
    expect(page1.items.map((m) => m.displayName)).toEqual(['Apple', 'Banana']);
    const page2 = medicationPageSchema.parse(
      (
        await request(ctx.app)
          .get(
            `${url}?sort=displayName&limit=2&cursor=${encodeURIComponent(page1.nextCursor ?? '')}`,
          )
          .set(user.auth)
      ).body,
    );
    expect(page2.items.map((m) => m.displayName)).toEqual(['Cherry']);
    expect(page2.nextCursor).toBeNull();

    const oldest = medicationPageSchema.parse(
      (await request(ctx.app).get(`${url}?sort=createdAt&limit=1`).set(user.auth)).body,
    );
    expect(oldest.items[0]?.displayName).toBe('Cherry');

    const stopped = await request(ctx.app).get(`${url}?status=stopped`).set(user.auth);
    expect(stopped.body.items).toEqual([]);
    expect((await request(ctx.app).get(`${url}?sort=rxcui`).set(user.auth)).status).toBe(422);
  });

  it('updates with If-Match, re-deriving ingredients when the match changes', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    const { id, etag } = await addMedication(ctx.app, user, profileId, { displayName: 'Demolol' });
    const url = `${api}/profiles/${profileId}/medications/${id}`;

    expect(
      (await request(ctx.app).patch(url).set(user.auth).send({ status: 'stopped' })).status,
    ).toBe(428);
    const matched = await request(ctx.app)
      .patch(url)
      .set(user.auth)
      .set('If-Match', etag)
      .send({ rxcui: 'DEMO-0001', strengthText: '10 mg' });
    expect(matched.status).toBe(200);
    expect(matched.body.ingredientRxcuis).toEqual(['DEMO-0001']);
    expect(matched.headers.etag).toBe('"v2"');

    const stale = await request(ctx.app)
      .patch(url)
      .set(user.auth)
      .set('If-Match', etag)
      .send({ status: 'stopped' });
    expect(stale.status).toBe(412);

    const cleared = await request(ctx.app)
      .patch(url)
      .set(user.auth)
      .set('If-Match', '"v2"')
      .send({ rxcui: null, status: 'stopped' });
    expect(cleared.body.ingredientRxcuis).toEqual([]);
    expect(cleared.body.status).toBe('stopped');

    const got = await request(ctx.app).get(url).set(user.auth);
    expect(got.headers.etag).toBe('"v3"');
  });

  it('deletes with 204 and answers 404 afterwards', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    const { id } = await addMedication(ctx.app, user, profileId, { displayName: 'Gone soon' });
    const url = `${api}/profiles/${profileId}/medications/${id}`;
    expect((await request(ctx.app).delete(url).set(user.auth)).status).toBe(204);
    expect((await request(ctx.app).get(url).set(user.auth)).status).toBe(404);
    expect((await request(ctx.app).delete(url).set(user.auth)).status).toBe(404);
  });

  it('cannot reach a medicine through another profile', async () => {
    const user = await registerUser(ctx.app);
    const first = await createProfile(ctx.app, user, 'First');
    const second = await createProfile(ctx.app, user, 'Second');
    const { id } = await addMedication(ctx.app, user, first.id, { displayName: 'Only in first' });
    const res = await request(ctx.app)
      .get(`${api}/profiles/${second.id}/medications/${id}`)
      .set(user.auth);
    expect(res.status).toBe(404);
  });

  it('replays an idempotent create', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    const send = () =>
      request(ctx.app)
        .post(`${api}/profiles/${profileId}/medications`)
        .set(user.auth)
        .set('Idempotency-Key', 'aaaa-bbbb-0001')
        .send({ displayName: 'Once only' });
    const first = await send();
    const second = await send();
    expect(second.body.id).toBe(first.body.id);
    const list = await request(ctx.app)
      .get(`${api}/profiles/${profileId}/medications`)
      .set(user.auth);
    expect(list.body.items).toHaveLength(1);
  });

  it('lets a caregiver write and keeps a viewer read-only', async () => {
    const owner = await registerUser(ctx.app);
    const carer = await registerUser(ctx.app);
    const viewer = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, owner);
    await shareProfile(ctx.app, owner, profileId, carer, 'caregiver');
    await shareProfile(ctx.app, owner, profileId, viewer, 'viewer');
    await addMedication(ctx.app, carer, profileId, { displayName: 'Added by carer' });
    const denied = await request(ctx.app)
      .post(`${api}/profiles/${profileId}/medications`)
      .set(viewer.auth)
      .send({ displayName: 'Nope' });
    expect(denied.status).toBe(403);
    const list = await request(ctx.app)
      .get(`${api}/profiles/${profileId}/medications`)
      .set(viewer.auth);
    expect(list.body.items).toHaveLength(1);
  });

  it('writes audit entries without the medicine name', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    await addMedication(ctx.app, user, profileId, { displayName: 'Highly Identifying Name' });
    const res = await request(ctx.app)
      .get(`${api}/profiles/${profileId}/audit-logs`)
      .set(user.auth);
    const page = auditLogPageSchema.parse(res.body);
    expect(page.items[0]?.action).toBe('medication.created');
    expect(JSON.stringify(res.body)).not.toContain('Highly Identifying Name');
  });

  it('caps active medicines per profile', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    for (let i = 0; i < 40; i += 1) {
      await addMedication(ctx.app, user, profileId, { displayName: `Med ${String(i)}` });
    }
    const res = await request(ctx.app)
      .post(`${api}/profiles/${profileId}/medications`)
      .set(user.auth)
      .send({ displayName: 'Forty-first' });
    expect(res.status).toBe(409);
  });
});
