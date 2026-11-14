import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ProfileRole } from '@medmap/shared';
import { createProfile, registerUser, setupTestApp, shareProfile } from '../helpers/app.js';
import type { TestUser } from '../helpers/app.js';

/**
 * Authorisation matrix for every profile-scoped endpoint.
 *
 * The cases are generated from the live route table. Each route with `:profileId` must
 * have an entry in EXPECTATIONS, so adding a profile route without deciding who may call
 * it fails this suite.
 */
const ctx = setupTestApp();
const api = '/api/v1';

interface Expectation {
  /** Lowest role allowed to call the route. */
  minRole: ProfileRole;
  body?: Record<string, unknown>;
  multipart?: boolean;
}

const EXPECTATIONS: Record<string, Expectation> = {
  'get /profiles/:profileId': { minRole: 'viewer' },
  'patch /profiles/:profileId': { minRole: 'owner', body: { displayName: 'Renamed' } },
  'delete /profiles/:profileId': { minRole: 'owner' },
  'get /profiles/:profileId/members': { minRole: 'viewer' },
  'put /profiles/:profileId/members/:userId': { minRole: 'owner', body: { role: 'viewer' } },
  'delete /profiles/:profileId/members/:userId': { minRole: 'owner' },
  'get /profiles/:profileId/invites': { minRole: 'owner' },
  'post /profiles/:profileId/invites': {
    minRole: 'owner',
    body: { email: 'someone-new@example.com', role: 'viewer' },
  },
  'delete /profiles/:profileId/invites/:inviteId': { minRole: 'owner' },
  'get /profiles/:profileId/audit-logs': { minRole: 'owner' },
};

const RANK: Record<ProfileRole, number> = { viewer: 1, caregiver: 2, owner: 3 };

let owner: TestUser;
let caregiver: TestUser;
let viewer: TestUser;
let outsider: TestUser;
let target: TestUser;
let profileId: string;

function call(app: Express, key: string, expectation: Expectation, user: TestUser | null) {
  const [method = 'get', template = ''] = key.split(' ');
  const path = template
    .replace(':profileId', profileId)
    .replace(':userId', target.id)
    .replace(':inviteId', 'e'.repeat(24))
    .replace(':medicationId', 'e'.repeat(24));
  let req = request(app)[method as 'get' | 'post' | 'put' | 'patch' | 'delete'](`${api}${path}`);
  if (user !== null) {
    req = req.set(user.auth);
  }
  if (method === 'patch' || method === 'put') {
    req = req.set('If-Match', '"v1"');
  }
  if (expectation.multipart === true) {
    return req.attach('images', Buffer.from('not an image'), 'label.jpg');
  }
  return expectation.body === undefined ? req : req.send(expectation.body);
}

beforeAll(async () => {
  owner = await registerUser(ctx.app, 'owner');
  caregiver = await registerUser(ctx.app, 'caregiver');
  viewer = await registerUser(ctx.app, 'viewer');
  outsider = await registerUser(ctx.app, 'outsider');
  target = await registerUser(ctx.app, 'target');
  profileId = (await createProfile(ctx.app, owner)).id;
  await shareProfile(ctx.app, owner, profileId, caregiver, 'caregiver');
  await shareProfile(ctx.app, owner, profileId, viewer, 'viewer');
  await shareProfile(ctx.app, owner, profileId, target, 'viewer');
});

describe('profile-scoped authorisation', () => {
  it('has an expectation for every profile-scoped route', () => {
    const scoped = ctx.routes
      .filter((route) => route.path.includes(':profileId'))
      .map((route) => `${route.method} ${route.path}`);
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.filter((key) => !(key in EXPECTATIONS))).toEqual([]);
    expect(Object.keys(EXPECTATIONS).filter((key) => !scoped.includes(key))).toEqual([]);
  });

  it('answers 401 to anonymous callers on every route', async () => {
    for (const [key, expectation] of Object.entries(EXPECTATIONS)) {
      const res = await call(ctx.app, key, expectation, null);
      expect(res.status, key).toBe(401);
    }
  });

  it('answers 404 to a signed-in user who is not a member, and returns no data', async () => {
    for (const [key, expectation] of Object.entries(EXPECTATIONS)) {
      const res = await call(ctx.app, key, expectation, outsider);
      expect(res.status, key).toBe(404);
      expect(JSON.stringify(res.body), key).not.toContain(owner.email);
      expect(res.body.items, key).toBeUndefined();
    }
  });

  it('answers 403 to members whose role is too low', async () => {
    const members: [ProfileRole, TestUser][] = [
      ['viewer', viewer],
      ['caregiver', caregiver],
    ];
    for (const [key, expectation] of Object.entries(EXPECTATIONS)) {
      for (const [role, user] of members) {
        if (RANK[role] >= RANK[expectation.minRole]) {
          continue;
        }
        // A member may always remove themselves, so target someone else here.
        const res = await call(ctx.app, key, expectation, user);
        expect(res.status, `${key} as ${role}`).toBe(403);
      }
    }
  });

  it('lets members with a high enough role through the access check', async () => {
    const members: [ProfileRole, TestUser][] = [
      ['viewer', viewer],
      ['caregiver', caregiver],
    ];
    for (const [key, expectation] of Object.entries(EXPECTATIONS)) {
      if (key.startsWith('delete') || key.startsWith('put') || key.startsWith('patch')) {
        continue;
      }
      for (const [role, user] of members) {
        if (RANK[role] < RANK[expectation.minRole]) {
          continue;
        }
        const res = await call(ctx.app, key, expectation, user);
        expect([401, 403, 404], `${key} as ${role}`).not.toContain(res.status);
      }
    }
  });

  it('does not reveal whether a profile id exists', async () => {
    const real = await request(ctx.app).get(`${api}/profiles/${profileId}`).set(outsider.auth);
    const fake = await request(ctx.app)
      .get(`${api}/profiles/${'9'.repeat(24)}`)
      .set(outsider.auth);
    expect(real.status).toBe(404);
    expect(fake.status).toBe(404);
    expect(real.body.detail).toBe(fake.body.detail);
  });
});
