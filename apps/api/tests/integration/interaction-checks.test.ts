import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { appConfigSchema, FORBIDDEN_RESULT_WORDS, interactionCheckSchema } from '@medmap/shared';
import { DemoDataGuardError } from '../../src/services/dataset.service.js';
import {
  addMedication,
  createProfile,
  registerUser,
  seedDemoDataset,
  setupTestApp,
} from '../helpers/app.js';
import { testEnv } from '../helpers/config.js';

const ctx = setupTestApp();
const api = '/api/v1';

function runServer(env: NodeJS.ProcessEnv): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', fileURLToPath(new URL('../../src/server.ts', import.meta.url))],
      { env: { PATH: process.env.PATH, ...env }, stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, 8000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

describe('before any dataset is loaded', () => {
  it('reports no dataset in the public config and answers 503 to a check', async () => {
    const config = appConfigSchema.parse((await request(ctx.app).get(`${api}/app-config`)).body);
    expect(config.dataset).toBeNull();
    expect(config.demoMode).toBe(false);

    const user = await registerUser(ctx.app);
    const { id } = await createProfile(ctx.app, user);
    const res = await request(ctx.app)
      .post(`${api}/profiles/${id}/interaction-checks`)
      .set(user.auth);
    expect(res.status).toBe(503);
    expect(res.body.type).toContain('no-dataset');
    const latest = await request(ctx.app)
      .get(`${api}/profiles/${id}/interaction-checks/latest`)
      .set(user.auth);
    expect(latest.status).toBe(404);
  });
});

describe('with the demo dataset', () => {
  it('imports the demo set, stores pairs sorted and reports it as demo', async () => {
    await seedDemoDataset(ctx);
    const config = appConfigSchema.parse((await request(ctx.app).get(`${api}/app-config`)).body);
    expect(config.demoMode).toBe(true);
    expect(config.dataset).toMatchObject({ name: 'MedMap demo set', kind: 'demo', pairCount: 8 });
    expect(config.labelExtraction.enabled).toBe(false);
  });

  it('re-importing the same version replaces it instead of duplicating', async () => {
    await seedDemoDataset(ctx);
    const config = appConfigSchema.parse((await request(ctx.app).get(`${api}/app-config`)).body);
    expect(config.dataset?.pairCount).toBe(8);
  });

  it('flags known pairs ranked by severity, lists unchecked medicines and names the dataset', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    await addMedication(ctx.app, user, profileId, { displayName: 'Demopress', rxcui: 'DEMO-0101' });
    await addMedication(ctx.app, user, profileId, { displayName: 'Duoflex', rxcui: 'DEMO-0102' });
    await addMedication(ctx.app, user, profileId, {
      displayName: 'Mockstatin',
      rxcui: 'DEMO-0004',
    });
    await addMedication(ctx.app, user, profileId, {
      displayName: 'Uncoveredine',
      rxcui: 'DEMO-0011',
    });
    await addMedication(ctx.app, user, profileId, {
      displayName: 'Unlabelled herbal mix',
      kind: 'supplement',
    });
    const stoppedMed = await addMedication(ctx.app, user, profileId, {
      displayName: 'Fakeoxetine',
      rxcui: 'DEMO-0005',
    });
    await request(ctx.app)
      .patch(`${api}/profiles/${profileId}/medications/${stoppedMed.id}`)
      .set(user.auth)
      .set('If-Match', stoppedMed.etag)
      .send({ status: 'stopped' });

    const res = await request(ctx.app)
      .post(`${api}/profiles/${profileId}/interaction-checks`)
      .set(user.auth);
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/profiles/${profileId}/interaction-checks/latest`);
    const check = interactionCheckSchema.parse(res.body);

    expect(check.datasetInfo).toMatchObject({
      name: 'MedMap demo set',
      version: '1.0.0',
      kind: 'demo',
    });
    expect(
      check.flaggedPairs.map((p) => [
        p.severity,
        p.medicationA.displayName,
        p.medicationB.displayName,
      ]),
    ).toEqual([
      ['serious', 'Demopress', 'Duoflex'],
      ['serious', 'Duoflex', 'Mockstatin'],
      ['moderate', 'Demopress', 'Mockstatin'],
    ]);
    expect(check.summary).toEqual({ serious: 2, moderate: 1, minor: 0 });
    expect(check.flaggedPairs[0]).toMatchObject({
      ingredientA: { rxcui: 'DEMO-0001', name: 'Demolol' },
      ingredientB: { rxcui: 'DEMO-0002', name: 'Samplifen' },
      sourceRef: 'demo:pair-001',
    });
    expect(check.uncheckedMedications.map((m) => [m.displayName, m.reason])).toEqual([
      ['Uncoveredine', 'not_in_dataset'],
      ['Unlabelled herbal mix', 'not_identified'],
    ]);
    expect(check.medications).toHaveLength(5);
    expect(check.medications.map((m) => m.displayName)).not.toContain('Fakeoxetine');
    expect(check.checkedPairCount).toBe(3);
    expect(check.stale).toBe(false);
  });

  it('never uses a forbidden result word anywhere in a response', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    await addMedication(ctx.app, user, profileId, { displayName: 'Placebex', rxcui: 'DEMO-0006' });
    await addMedication(ctx.app, user, profileId, {
      displayName: 'Trialcillin',
      rxcui: 'DEMO-0008',
    });
    const res = await request(ctx.app)
      .post(`${api}/profiles/${profileId}/interaction-checks`)
      .set(user.auth);
    const check = interactionCheckSchema.parse(res.body);
    expect(check.flaggedPairs).toEqual([]);
    expect(check.checkedPairCount).toBe(1);
    const text = JSON.stringify(res.body).toLowerCase();
    for (const word of FORBIDDEN_RESULT_WORDS) {
      expect(text).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
    // No field of the result says anything about unflagged pairs.
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'checkedPairCount',
        'createdAt',
        'datasetInfo',
        'flaggedPairs',
        'id',
        'medications',
        'profileId',
        'stale',
        'summary',
        'uncheckedMedications',
      ].sort(),
    );
  });

  it('returns the latest check and marks it stale when the medicine list changes', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    await addMedication(ctx.app, user, profileId, { displayName: 'Demolol', rxcui: 'DEMO-0001' });
    const url = `${api}/profiles/${profileId}/interaction-checks`;
    const created = await request(ctx.app).post(url).set(user.auth);

    const fresh = await request(ctx.app).get(`${url}/latest`).set(user.auth);
    expect(fresh.status).toBe(200);
    expect(fresh.body.id).toBe(created.body.id);
    expect(fresh.body.stale).toBe(false);

    await addMedication(ctx.app, user, profileId, { displayName: 'Samplifen', rxcui: 'DEMO-0002' });
    const stale = await request(ctx.app).get(`${url}/latest`).set(user.auth);
    expect(stale.body.stale).toBe(true);
    expect(stale.body.flaggedPairs).toEqual([]);

    const rerun = await request(ctx.app).post(url).set(user.auth);
    expect(rerun.body.flaggedPairs).toHaveLength(1);
    expect(rerun.body.id).not.toBe(created.body.id);
  });

  it('keeps only the five most recent checks per profile', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    const url = `${api}/profiles/${profileId}/interaction-checks`;
    const ids: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      ids.push(((await request(ctx.app).post(url).set(user.auth)).body as { id: string }).id);
    }
    const latest = await request(ctx.app).get(`${url}/latest`).set(user.auth);
    expect(latest.body.id).toBe(ids.at(-1));
    const audit = await request(ctx.app)
      .get(`${api}/profiles/${profileId}/audit-logs?limit=100`)
      .set(user.auth);
    const runs = (audit.body.items as { action: string }[]).filter(
      (entry) => entry.action === 'interaction_check.run',
    );
    expect(runs).toHaveLength(7);
  });

  it('handles an empty medicine list', async () => {
    const user = await registerUser(ctx.app);
    const { id: profileId } = await createProfile(ctx.app, user);
    const res = await request(ctx.app)
      .post(`${api}/profiles/${profileId}/interaction-checks`)
      .set(user.auth);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      flaggedPairs: [],
      uncheckedMedications: [],
      checkedPairCount: 0,
    });
  });
});

describe('demo-data guard (safety rule 6)', () => {
  it('throws in production with a demo dataset unless ALLOW_DEMO_DATA is set', async () => {
    await seedDemoDataset(ctx);
    await expect(
      ctx.datasets.assertStartupGuard({ isProduction: true, allowDemoData: false }),
    ).rejects.toBeInstanceOf(DemoDataGuardError);
    await expect(
      ctx.datasets.assertStartupGuard({ isProduction: true, allowDemoData: true }),
    ).resolves.toMatchObject({ kind: 'demo' });
    await expect(
      ctx.datasets.assertStartupGuard({ isProduction: false, allowDemoData: false }),
    ).resolves.toMatchObject({ kind: 'demo' });
  });

  it('the real server process refuses to start in production on demo data', async () => {
    await seedDemoDataset(ctx);
    const result = await runServer({
      ...testEnv({ MONGODB_URI: ctx.mongoUri, ALLOW_DEMO_DATA: undefined, LOG_LEVEL: 'silent' }),
      NODE_ENV: 'production',
      PORT: '45871',
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('DEMO data');
    expect(result.stderr).toContain('ALLOW_DEMO_DATA');
  }, 30_000);

  it('an imported real dataset replaces the demo one as active and passes the guard', async () => {
    const summary = await ctx.datasets.importDataset(
      {
        name: 'Test real set',
        version: '2026.1',
        kind: 'real',
        licenceStatus: 'confirmed',
        activate: true,
      },
      [
        {
          ingredientA: '9',
          ingredientB: '1',
          nameA: 'nine',
          nameB: 'one',
          severity: 'minor',
          sourceRef: 'T-1',
        },
        { ingredientA: '1', ingredientB: '9', severity: 'serious', sourceRef: 'T-dup' },
        { ingredientA: '5', ingredientB: '5', severity: 'minor', sourceRef: 'T-self' },
      ],
    );
    expect(summary).toMatchObject({ received: 3, imported: 1, skippedSelfPairs: 1, duplicates: 1 });
    const active = await ctx.datasets.assertStartupGuard({
      isProduction: true,
      allowDemoData: false,
    });
    expect(active).toMatchObject({ name: 'Test real set', kind: 'real' });
    const config = appConfigSchema.parse((await request(ctx.app).get(`${api}/app-config`)).body);
    expect(config.demoMode).toBe(false);

    // Demo names are no longer offered once a real dataset is active.
    const user = await registerUser(ctx.app);
    const lookup = await request(ctx.app).get(`${api}/drugs/normalize?term=Demolol`).set(user.auth);
    expect(lookup.body.candidates).toEqual([]);
  });
});
