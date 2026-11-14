import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { SEVERITIES } from '@medmap/shared';
import { sharedFixturePath } from '../integrations/rxnorm/demo-normalizer.js';
import { DatasetRepository } from '../repositories/dataset.repository.js';
import { ensureIndexes } from '../repositories/db.js';
import { DatasetService } from '../services/dataset.service.js';
import { systemClock } from '../utils/clock.js';
import { runJob } from './runtime.js';

const fixtureSchema = z.object({
  name: z.string(),
  version: z.string(),
  kind: z.literal('demo'),
  licenceStatus: z.literal('not-applicable'),
  pairs: z.array(
    z.object({
      ingredientA: z.string(),
      ingredientB: z.string(),
      nameA: z.string().nullable(),
      nameB: z.string().nullable(),
      severity: z.enum(SEVERITIES),
      mechanism: z.string().nullable(),
      sourceRef: z.string(),
    }),
  ),
});

/**
 * Loads the made-up demo dataset and makes it active. For local demos, tests and staging.
 * In production it refuses to run unless ALLOW_DEMO_DATA=true, and it never replaces an
 * active real dataset.
 */
runJob('seed-demo', async (config, print) => {
  if (config.isProduction && !config.allowDemoData) {
    throw new Error('refusing to seed demo data in production without ALLOW_DEMO_DATA=true');
  }
  await ensureIndexes();
  const service = new DatasetService(new DatasetRepository(), systemClock);
  const active = await service.getActive();
  if (active?.kind === 'real') {
    throw new Error(
      `a real dataset is active (${active.name} ${active.version}); not replacing it`,
    );
  }
  const fixture = fixtureSchema.parse(
    JSON.parse(readFileSync(sharedFixturePath('demo-interactions.json'), 'utf8')),
  );
  const summary = await service.importDataset(
    {
      name: fixture.name,
      version: fixture.version,
      kind: 'demo',
      licenceStatus: 'not-applicable',
      activate: true,
    },
    fixture.pairs,
  );
  print(
    `seeded ${summary.dataset.name} ${summary.dataset.version}: ${String(summary.imported)} pairs (DEMO)`,
  );
});
