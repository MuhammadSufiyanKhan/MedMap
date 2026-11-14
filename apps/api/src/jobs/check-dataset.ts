import { DatasetRepository } from '../repositories/dataset.repository.js';
import { runJob } from './runtime.js';

/**
 * Release gate used by the production pipeline. Fails unless the active dataset is a real
 * one whose licence has been confirmed.
 */
runJob('check-dataset', async (_config, print) => {
  const active = await new DatasetRepository().getActiveDataset();
  if (active === null) {
    throw new Error('no interaction dataset is active. Import one before releasing to production.');
  }
  if (active.kind === 'demo') {
    throw new Error(
      `the active dataset "${active.name}" is DEMO data. Production needs a real dataset with a confirmed licence.`,
    );
  }
  if (active.licenceStatus !== 'confirmed') {
    throw new Error(`the licence of "${active.name}" is "${active.licenceStatus}", not confirmed.`);
  }
  print(
    `ok: ${active.name} ${active.version} (${String(active.pairCount)} pairs, licence confirmed)`,
  );
});
