import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { LICENCE_STATUSES } from '@medmap/shared';
import type { LicenceStatus } from '@medmap/shared';
import { RxNormNormalizer } from '../integrations/rxnorm/rxnorm-client.js';
import { DatasetRepository } from '../repositories/dataset.repository.js';
import { ensureIndexes } from '../repositories/db.js';
import { mapDdinterRow, mapMedmapRow } from '../services/dataset-import.js';
import type { NameResolver, RowProblem } from '../services/dataset-import.js';
import { DatasetService } from '../services/dataset.service.js';
import type { ImportPair } from '../services/dataset.service.js';
import { systemClock } from '../utils/clock.js';
import { parseCsvWithHeader } from '../utils/csv.js';
import { runJob } from './runtime.js';

const USAGE = `Usage:
  npm run import:interactions -- --file <path.csv> --name <dataset name> --version <version>
      [--format medmap|ddinter] [--licence-status unverified|confirmed] [--activate]

The file must be a local CSV that you obtained yourself. This job never downloads data.
--activate requires --licence-status confirmed.`;

function isLicenceStatus(value: string): value is LicenceStatus {
  return (LICENCE_STATUSES as readonly string[]).includes(value);
}

/**
 * Imports a real interaction dataset from a local CSV file.
 *
 * SAFETY: a dataset can only be activated when the operator states that its licence is
 * confirmed. Severity and mechanism are stored exactly as they appear in the file.
 */
runJob('import-interactions', async (config, print) => {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      name: { type: 'string' },
      version: { type: 'string' },
      format: { type: 'string', default: 'medmap' },
      'licence-status': { type: 'string', default: 'unverified' },
      activate: { type: 'boolean', default: false },
    },
  });
  const licenceStatus = values['licence-status'];
  if (
    values.file === undefined ||
    values.name === undefined ||
    values.version === undefined ||
    (values.format !== 'medmap' && values.format !== 'ddinter') ||
    !isLicenceStatus(licenceStatus) ||
    licenceStatus === 'not-applicable'
  ) {
    throw new Error(`invalid arguments\n${USAGE}`);
  }
  if (values.activate && licenceStatus !== 'confirmed') {
    throw new Error(
      '--activate needs --licence-status confirmed. Confirm the licence and terms first.',
    );
  }

  await ensureIndexes();
  const problems: RowProblem[] = [];
  const text = readFileSync(values.file, 'utf8');

  const nameCache = new Map<string, { rxcui: string; name: string } | null>();
  const rxnorm = new RxNormNormalizer(config.rxnorm.baseUrl, (url, init) => fetch(url, init));
  const resolveName: NameResolver = async (name) => {
    const key = name.toLowerCase();
    const cached = nameCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const exact = (await rxnorm.search(name)).filter((candidate) => candidate.score === null);
    const ingredients = new Map(
      exact.flatMap((candidate) => candidate.ingredients).map((item) => [item.rxcui, item]),
    );
    const only = ingredients.size === 1 ? ([...ingredients.values()][0] ?? null) : null;
    nameCache.set(key, only);
    return only;
  };

  const format = values.format;
  async function* pairs(): AsyncGenerator<ImportPair> {
    let line = 1;
    for (const record of parseCsvWithHeader(text)) {
      line += 1;
      const mapped =
        format === 'medmap' ? mapMedmapRow(record) : await mapDdinterRow(record, resolveName);
      if (typeof mapped === 'string') {
        problems.push({ line, reason: mapped });
      } else {
        yield mapped;
      }
    }
  }

  const service = new DatasetService(new DatasetRepository(), systemClock);
  const summary = await service.importDataset(
    {
      name: values.name,
      version: values.version,
      kind: 'real',
      licenceStatus,
      activate: values.activate,
    },
    pairs(),
  );

  print(`dataset: ${summary.dataset.name} ${summary.dataset.version} (licence: ${licenceStatus})`);
  print(`rows mapped: ${String(summary.received)}, pairs stored: ${String(summary.imported)}`);
  print(
    `duplicates: ${String(summary.duplicates)}, self-pairs dropped: ${String(summary.skippedSelfPairs)}`,
  );
  print(`rows skipped: ${String(problems.length)}`);
  for (const problem of problems.slice(0, 50)) {
    print(`  line ${String(problem.line)}: ${problem.reason}`);
  }
  if (problems.length > 50) {
    print(`  ... and ${String(problems.length - 50)} more`);
  }
  print(
    values.activate ? 'dataset is now ACTIVE' : 'dataset imported but NOT active (use --activate)',
  );
});
