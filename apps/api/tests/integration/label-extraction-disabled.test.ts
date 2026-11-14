import { readFileSync } from 'node:fs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { sharedFixturePath } from '../../src/integrations/rxnorm/demo-normalizer.js';
import { createProfile, registerUser, setupTestApp } from '../helpers/app.js';

const off = '/api/v1';
const fixture = (file: string): Buffer => readFileSync(sharedFixturePath(`labels/${file}`));
const url = (profileId: string): string => `${off}/profiles/${profileId}/label-extractions`;
const disabled = setupTestApp({ LABEL_EXTRACTION_ENABLED: 'false' });

describe('when label extraction is switched off', () => {
  it('answers 503 and reports it in the public config', async () => {
    const user = await registerUser(disabled.app);
    const { id } = await createProfile(disabled.app, user);
    const res = await request(disabled.app)
      .post(url(id))
      .set(user.auth)
      .attach('images', fixture('label-01-demolol.png'), 'a.png');
    expect(res.status).toBe(503);
    expect(res.body.type).toContain('label-extraction-disabled');
    const config = await request(disabled.app).get(`${off}/app-config`);
    expect(config.body.labelExtraction).toMatchObject({ enabled: false, provider: null });
  });
});
