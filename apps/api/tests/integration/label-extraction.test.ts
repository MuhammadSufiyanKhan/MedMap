import { readFileSync } from 'node:fs';
import request from 'supertest';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { labelExtractionResponseSchema } from '@medmap/shared';
import type { LabelExtractor } from '../../src/integrations/label-extractor/extractor.js';
import { MockExtractor } from '../../src/integrations/label-extractor/mock.js';
import { sharedFixturePath } from '../../src/integrations/rxnorm/demo-normalizer.js';
import { createProfile, registerUser, setupTestApp, shareProfile } from '../helpers/app.js';

/** Wraps the mock so individual tests can make the provider slow or broken. */
const controllable: LabelExtractor & { mode: 'ok' | 'slow' | 'broken'; seen: Buffer[] } = {
  name: 'controllable mock',
  mode: 'ok',
  seen: [],
  async extract(image) {
    this.seen.push(image);
    if (this.mode === 'broken') {
      throw new Error('provider exploded with secret detail');
    }
    if (this.mode === 'slow') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return new MockExtractor().extract(image);
  },
};

const ctx = setupTestApp(
  { LABEL_EXTRACTION_ENABLED: 'true', EXTRACTION_DAILY_CAP: '6', EXTRACTION_TIMEOUT_MS: '1000' },
  () => ({ labelExtractor: controllable }),
);
const off = '/api/v1';
const fixture = (file: string): Buffer => readFileSync(sharedFixturePath(`labels/${file}`));
const url = (profileId: string): string => `${off}/profiles/${profileId}/label-extractions`;

describe('POST /profiles/:profileId/label-extractions', () => {
  it('returns candidates per image, flags low confidence, and saves nothing', async () => {
    controllable.mode = 'ok';
    const user = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, user);
    const res = await request(ctx.app)
      .post(url(id))
      .set(user.auth)
      .attach('images', fixture('label-01-demolol.png'), 'one.png')
      .attach('images', fixture('label-06-smudged.png'), 'two.png');
    expect(res.status).toBe(200);
    const body = labelExtractionResponseSchema.parse(res.body);
    expect(body.candidates.map((c) => [c.imageIndex, c.name, c.needsReview])).toEqual([
      [0, 'Demolol', false],
      [1, 'Fakeoxetine', true],
    ]);
    expect(body.failures).toEqual([]);
    expect(body.remainingToday).toBe(4);
    expect(res.headers['cache-control']).toBe('no-store');

    const meds = await request(ctx.app).get(`${off}/profiles/${id}/medications`).set(user.auth);
    expect(meds.body.items).toEqual([]);
  });

  it('sends the provider a re-encoded image without the original metadata', async () => {
    controllable.mode = 'ok';
    controllable.seen = [];
    const user = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, user);
    const withExif = await sharp(fixture('label-02-samplifen.png'))
      .withExif({ IFD0: { ImageDescription: 'taken at 1 Example Street' } })
      .jpeg()
      .toBuffer();
    const res = await request(ctx.app)
      .post(url(id))
      .set(user.auth)
      .attach('images', withExif, 'photo.jpg');
    expect(res.status).toBe(200);
    expect(res.body.candidates[0].name).toBe('Samplifen');
    const sent = controllable.seen[0];
    expect(sent?.includes(Buffer.from('Example Street'))).toBe(false);
    expect((await sharp(sent).metadata()).exif).toBeUndefined();
  });

  it('reports unreadable photos as failures so the user can type them', async () => {
    controllable.mode = 'ok';
    const user = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, user);
    const blank = await sharp({
      create: { width: 90, height: 90, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    const res = await request(ctx.app)
      .post(url(id))
      .set(user.auth)
      .attach('images', blank, 'blank.png');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      candidates: [],
      failures: [{ imageIndex: 0, reason: 'unreadable' }],
    });
  });

  it('turns provider errors and timeouts into failures without leaking details', async () => {
    const user = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, user);
    controllable.mode = 'broken';
    const broken = await request(ctx.app)
      .post(url(id))
      .set(user.auth)
      .attach('images', fixture('label-01-demolol.png'), 'a.png');
    expect(broken.status).toBe(200);
    expect(broken.body.failures).toEqual([{ imageIndex: 0, reason: 'provider_error' }]);
    expect(JSON.stringify(broken.body)).not.toContain('secret detail');

    controllable.mode = 'slow';
    const slow = await request(ctx.app)
      .post(url(id))
      .set(user.auth)
      .attach('images', fixture('label-01-demolol.png'), 'a.png');
    expect(slow.body.failures).toEqual([{ imageIndex: 0, reason: 'timeout' }]);
    controllable.mode = 'ok';
  });

  it('rejects files that are not real images, whatever they are called (415)', async () => {
    const user = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, user);
    for (const [bytes, name, type] of [
      [
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
        'x.png',
        'image/png',
      ],
      [Buffer.from('%PDF-1.7 fake'), 'label.jpg', 'image/jpeg'],
      [Buffer.from('#!/bin/sh\nrm -rf /'), 'photo.jpeg', 'image/jpeg'],
    ] as const) {
      const res = await request(ctx.app)
        .post(url(id))
        .set(user.auth)
        .attach('images', bytes, { filename: name, contentType: type });
      expect(res.status, name).toBe(415);
      expect(res.headers['content-type']).toContain('application/problem+json');
    }
  });

  it('enforces size, count and content type limits', async () => {
    const user = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, user);
    const tooBig = await request(ctx.app)
      .post(url(id))
      .set(user.auth)
      .attach('images', Buffer.alloc(5 * 1024 * 1024 + 10, 1), 'big.jpg');
    expect(tooBig.status).toBe(413);

    let four = request(ctx.app).post(url(id)).set(user.auth);
    for (let i = 0; i < 4; i += 1) {
      four = four.attach('images', fixture('label-01-demolol.png'), `${String(i)}.png`);
    }
    expect((await four).status).toBe(413);

    const json = await request(ctx.app)
      .post(url(id))
      .set(user.auth)
      .send({ images: ['data:...'] });
    expect(json.status).toBe(415);
    const wrongField = await request(ctx.app)
      .post(url(id))
      .set(user.auth)
      .attach('file', fixture('label-01-demolol.png'), 'a.png');
    expect(wrongField.status).toBe(400);
    const extraField = await request(ctx.app)
      .post(url(id))
      .set(user.auth)
      .field('profileId', 'x')
      .attach('images', fixture('label-01-demolol.png'), 'a.png');
    expect(extraField.status).toBe(400);
    const none = await request(ctx.app)
      .post(url(id))
      .set(user.auth)
      .set('Content-Type', 'multipart/form-data; boundary=x')
      .send('--x--\r\n');
    expect(none.status).toBe(422);
  });

  it('requires sign-in before reading any upload, and a caregiver role or higher', async () => {
    const owner = await registerUser(ctx.app);
    const viewer = await registerUser(ctx.app);
    const outsider = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, owner);
    await shareProfile(ctx.app, owner, id, viewer, 'viewer');
    const image = fixture('label-01-demolol.png');
    expect((await request(ctx.app).post(url(id)).attach('images', image, 'a.png')).status).toBe(
      401,
    );
    expect(
      (await request(ctx.app).post(url(id)).set(viewer.auth).attach('images', image, 'a.png'))
        .status,
    ).toBe(403);
    expect(
      (await request(ctx.app).post(url(id)).set(outsider.auth).attach('images', image, 'a.png'))
        .status,
    ).toBe(404);
  });

  it('enforces the per-user daily cap with 429 and resets the next day', async () => {
    controllable.mode = 'ok';
    const user = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, user);
    const send = (count: number) => {
      let req = request(ctx.app).post(url(id)).set(user.auth);
      for (let i = 0; i < count; i += 1) {
        req = req.attach('images', fixture('label-01-demolol.png'), `${String(i)}.png`);
      }
      return req;
    };
    expect((await send(3)).body.remainingToday).toBe(3);
    expect((await send(3)).body.remainingToday).toBe(0);
    const over = await send(1);
    expect(over.status).toBe(429);
    expect(Number(over.headers['retry-after'])).toBeGreaterThan(0);

    ctx.advance(24 * 60 * 60 * 1000);
    expect((await send(1)).status).toBe(200);
    ctx.advance(-24 * 60 * 60 * 1000);
  });

  it('does not spend allowance on a rejected upload', async () => {
    const user = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, user);
    await request(ctx.app)
      .post(url(id))
      .set(user.auth)
      .attach('images', Buffer.from('not an image'), 'a.png');
    const ok = await request(ctx.app)
      .post(url(id))
      .set(user.auth)
      .attach('images', fixture('label-01-demolol.png'), 'a.png');
    expect(ok.body.remainingToday).toBe(5);
  });

  it('records an audit entry with ids only', async () => {
    const user = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, user);
    await request(ctx.app)
      .post(url(id))
      .set(user.auth)
      .attach('images', fixture('label-01-demolol.png'), 'a.png');
    const audit = await request(ctx.app).get(`${off}/profiles/${id}/audit-logs`).set(user.auth);
    expect(audit.body.items[0].action).toBe('label_extraction.requested');
    expect(JSON.stringify(audit.body)).not.toContain('Demolol');
  });
});
