import { ensureIndexes } from '../repositories/db.js';
import { runJob } from './runtime.js';

/**
 * Migration job: creates every declared index. Idempotent, safe to run on each deploy.
 * Schema changes that need data rewrites are added here as numbered steps.
 */
runJob('migrate', async (_config, print) => {
  const report = await ensureIndexes();
  for (const row of report) {
    print(`${row.collection}: ${String(row.indexes)} indexes`);
  }
  print('migrations complete');
});
