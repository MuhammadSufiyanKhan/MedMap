import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  auditLogPageSchema,
  createdInviteSchema,
  invitePageSchema,
  memberPageSchema,
  memberSchema,
} from '@medmap/shared';
import {
  createProfile,
  lastEmailToken,
  registerUser,
  setupTestApp,
  shareProfile,
} from '../helpers/app.js';

const ctx = setupTestApp();
const api = '/api/v1';

describe('invites', () => {
  it('creates an invite, emails a link without profile details, and returns the token once', async () => {
    const owner = await registerUser(ctx.app, 'owner');
    const invitee = await registerUser(ctx.app, 'carer');
    const { id } = await createProfile(ctx.app, owner, 'Secret Name');
    const res = await request(ctx.app)
      .post(`${api}/profiles/${id}/invites`)
      .set(owner.auth)
      .send({ email: invitee.email, role: 'caregiver' });
    expect(res.status).toBe(201);
    const invite = createdInviteSchema.parse(res.body);
    expect(res.headers.location).toBe(`/api/v1/profiles/${id}/invites/${invite.id}`);
    expect(lastEmailToken(ctx.email, invitee.email)).toBe(invite.token);
    const message = ctx.email.sent.findLast((m) => m.to === invitee.email);
    expect(message?.text).not.toContain('Secret Name');

    const list = await request(ctx.app).get(`${api}/profiles/${id}/invites`).set(owner.auth);
    const page = invitePageSchema.parse(list.body);
    expect(page.items).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(invite.token);
    expect(JSON.stringify(list.body)).not.toContain('tokenHash');
  });

  it('cannot grant ownership through an invite', async () => {
    const owner = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, owner);
    const res = await request(ctx.app)
      .post(`${api}/profiles/${id}/invites`)
      .set(owner.auth)
      .send({ email: 'x@example.com', role: 'owner' });
    expect(res.status).toBe(422);
  });

  it('accepts an invite once, for the invited address only', async () => {
    const owner = await registerUser(ctx.app);
    const invitee = await registerUser(ctx.app);
    const stranger = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, owner);
    const created = await request(ctx.app)
      .post(`${api}/profiles/${id}/invites`)
      .set(owner.auth)
      .send({ email: invitee.email, role: 'viewer' });
    const token = created.body.token as string;

    const wrongUser = await request(ctx.app)
      .post(`${api}/invite-acceptances`)
      .set(stranger.auth)
      .send({ token });
    expect(wrongUser.status).toBe(403);
    expect((await request(ctx.app).get(`${api}/profiles/${id}`).set(stranger.auth)).status).toBe(
      404,
    );

    const accepted = await request(ctx.app)
      .post(`${api}/invite-acceptances`)
      .set(invitee.auth)
      .send({ token });
    expect(accepted.status).toBe(201);
    expect(memberSchema.parse(accepted.body).role).toBe('viewer');
    expect(accepted.headers.location).toBe(`/api/v1/profiles/${id}`);

    const again = await request(ctx.app)
      .post(`${api}/invite-acceptances`)
      .set(invitee.auth)
      .send({ token });
    expect(again.status).toBe(400);

    const profile = await request(ctx.app).get(`${api}/profiles/${id}`).set(invitee.auth);
    expect(profile.status).toBe(200);
    expect(profile.body.role).toBe('viewer');
  });

  it('rejects unknown, expired and revoked invites', async () => {
    const owner = await registerUser(ctx.app);
    const invitee = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, owner);
    const unknown = await request(ctx.app)
      .post(`${api}/invite-acceptances`)
      .set(invitee.auth)
      .send({ token: 'x'.repeat(43) });
    expect(unknown.status).toBe(400);

    const created = await request(ctx.app)
      .post(`${api}/profiles/${id}/invites`)
      .set(owner.auth)
      .send({ email: invitee.email, role: 'viewer' });
    ctx.advance(8 * 24 * 60 * 60 * 1000);
    const expired = await request(ctx.app)
      .post(`${api}/invite-acceptances`)
      .set(invitee.auth)
      .send({ token: created.body.token });
    expect(expired.status).toBe(400);
    ctx.advance(-8 * 24 * 60 * 60 * 1000);

    const revoke = await request(ctx.app)
      .delete(`${api}/profiles/${id}/invites/${String(created.body.id)}`)
      .set(owner.auth);
    expect(revoke.status).toBe(204);
    const revoked = await request(ctx.app)
      .post(`${api}/invite-acceptances`)
      .set(invitee.auth)
      .send({ token: created.body.token });
    expect(revoked.status).toBe(400);
  });

  it('answers 409 when the person is already a member', async () => {
    const owner = await registerUser(ctx.app);
    const carer = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, owner);
    await shareProfile(ctx.app, owner, id, carer, 'caregiver');
    const res = await request(ctx.app)
      .post(`${api}/profiles/${id}/invites`)
      .set(owner.auth)
      .send({ email: carer.email, role: 'viewer' });
    expect(res.status).toBe(409);
  });
});

describe('members', () => {
  it('lists members with emails and roles', async () => {
    const owner = await registerUser(ctx.app);
    const carer = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, owner);
    await shareProfile(ctx.app, owner, id, carer, 'caregiver');
    const res = await request(ctx.app).get(`${api}/profiles/${id}/members`).set(carer.auth);
    expect(res.status).toBe(200);
    const page = memberPageSchema.parse(res.body);
    expect(page.items.map((m) => m.role).sort()).toEqual(['caregiver', 'owner']);
    expect(page.items.map((m) => m.email)).toEqual(
      expect.arrayContaining([owner.email, carer.email]),
    );
  });

  it('replaces a role with PUT and If-Match', async () => {
    const owner = await registerUser(ctx.app);
    const carer = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, owner);
    await shareProfile(ctx.app, owner, id, carer, 'caregiver');
    const url = `${api}/profiles/${id}/members/${carer.id}`;

    expect((await request(ctx.app).put(url).set(owner.auth).send({ role: 'viewer' })).status).toBe(
      428,
    );
    const ok = await request(ctx.app)
      .put(url)
      .set(owner.auth)
      .set('If-Match', '"v1"')
      .send({ role: 'viewer' });
    expect(ok.status).toBe(200);
    expect(ok.body.role).toBe('viewer');
    expect(ok.headers.etag).toBe('"v2"');
    const stale = await request(ctx.app)
      .put(url)
      .set(owner.auth)
      .set('If-Match', '"v1"')
      .send({ role: 'caregiver' });
    expect(stale.status).toBe(412);
  });

  it('never changes or removes the owner', async () => {
    const owner = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, owner);
    const url = `${api}/profiles/${id}/members/${owner.id}`;
    const change = await request(ctx.app)
      .put(url)
      .set(owner.auth)
      .set('If-Match', '"v1"')
      .send({ role: 'viewer' });
    expect(change.status).toBe(403);
    expect((await request(ctx.app).delete(url).set(owner.auth)).status).toBe(403);
  });

  it('lets a member leave, and lets only the owner remove others', async () => {
    const owner = await registerUser(ctx.app);
    const carer = await registerUser(ctx.app);
    const viewer = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, owner);
    await shareProfile(ctx.app, owner, id, carer, 'caregiver');
    await shareProfile(ctx.app, owner, id, viewer, 'viewer');

    const carerRemovesViewer = await request(ctx.app)
      .delete(`${api}/profiles/${id}/members/${viewer.id}`)
      .set(carer.auth);
    expect(carerRemovesViewer.status).toBe(403);

    const viewerLeaves = await request(ctx.app)
      .delete(`${api}/profiles/${id}/members/${viewer.id}`)
      .set(viewer.auth);
    expect(viewerLeaves.status).toBe(204);
    expect((await request(ctx.app).get(`${api}/profiles/${id}`).set(viewer.auth)).status).toBe(404);

    const ownerRemovesCarer = await request(ctx.app)
      .delete(`${api}/profiles/${id}/members/${carer.id}`)
      .set(owner.auth);
    expect(ownerRemovesCarer.status).toBe(204);
    expect((await request(ctx.app).get(`${api}/profiles/${id}`).set(carer.auth)).status).toBe(404);
  });
});

describe('audit log', () => {
  it('records actions with ids only and is readable by the owner alone', async () => {
    const owner = await registerUser(ctx.app);
    const carer = await registerUser(ctx.app);
    const { id, etag } = await createProfile(ctx.app, owner, 'Very Private Name');
    await shareProfile(ctx.app, owner, id, carer, 'caregiver');
    await request(ctx.app)
      .patch(`${api}/profiles/${id}`)
      .set(owner.auth)
      .set('If-Match', etag)
      .send({ notes: 'private note text' });

    const res = await request(ctx.app).get(`${api}/profiles/${id}/audit-logs`).set(owner.auth);
    expect(res.status).toBe(200);
    const page = auditLogPageSchema.parse(res.body);
    expect(page.items.map((e) => e.action)).toEqual([
      'profile.updated',
      'invite.accepted',
      'invite.created',
      'profile.created',
    ]);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('Very Private Name');
    expect(raw).not.toContain('private note text');
    expect(raw).not.toContain(carer.email);

    const asCarer = await request(ctx.app).get(`${api}/profiles/${id}/audit-logs`).set(carer.auth);
    expect(asCarer.status).toBe(403);
  });
});
