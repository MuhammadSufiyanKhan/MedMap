import { loadConfig } from '../config/env.js';
import { RxNormNormalizer } from '../integrations/rxnorm/rxnorm-client.js';

/**
 * Live contract check for the RxNorm adapter. The unit tests run against hand-written
 * fixtures, so this job (run nightly in CI, where the network is open) confirms that the
 * real service still answers in the shape the adapter expects.
 */
async function main(): Promise<void> {
  const config = loadConfig({
    MONGODB_URI: 'mongodb://localhost/unused',
    JWT_ACCESS_SECRET: 'rxnorm-check-placeholder-secret-00000',
    ...process.env,
  });
  const client = new RxNormNormalizer(config.rxnorm.baseUrl, (url, init) => fetch(url, init));
  const exact = await client.search('aspirin');
  const first = exact[0];
  if (first === undefined || first.ingredients.length === 0) {
    throw new Error('exact search for "aspirin" returned no candidate with ingredients');
  }
  const approximate = await client.search('asprin');
  if (approximate.length === 0) {
    throw new Error('approximate search for "asprin" returned nothing');
  }
  const concept = await client.resolve(first.rxcui);
  if (concept === null) {
    throw new Error(`resolve(${first.rxcui}) returned null`);
  }
  process.stdout.write(
    `RxNorm contract OK: aspirin -> ${first.rxcui} (${first.termType}), ${String(approximate.length)} approximate candidates\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `RxNorm contract check failed: ${error instanceof Error ? error.message : 'unknown'}\n`,
  );
  process.exit(1);
});
