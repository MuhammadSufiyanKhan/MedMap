import type { DatasetKind, LicenceStatus, Severity } from '@medmap/shared';
import { orderPair } from '../engine/engine.js';
import type { DatasetRepository, PairInput } from '../repositories/dataset.repository.js';
import type { InteractionDatasetEntity } from '../types/entities.js';
import type { Clock } from '../utils/clock.js';

/** Thrown at boot when production would serve the demo dataset without the explicit flag. */
export class DemoDataGuardError extends Error {
  public constructor() {
    super(
      'Refusing to start: the active interaction dataset is DEMO data and NODE_ENV=production. ' +
        'Import a real dataset whose licence you have confirmed, or set ALLOW_DEMO_DATA=true ' +
        'for a non-public demo deployment.',
    );
    this.name = 'DemoDataGuardError';
  }
}

export interface ImportPair {
  ingredientA: string;
  ingredientB: string;
  nameA?: string | null;
  nameB?: string | null;
  severity: Severity;
  mechanism?: string | null;
  sourceRef: string;
}

export interface ImportSummary {
  dataset: InteractionDatasetEntity;
  received: number;
  imported: number;
  skippedSelfPairs: number;
  duplicates: number;
}

const BATCH_SIZE = 1000;

export class DatasetService {
  public constructor(
    private readonly datasets: DatasetRepository,
    private readonly clock: Clock,
  ) {}

  public getActive(): Promise<InteractionDatasetEntity | null> {
    return this.datasets.getActiveDataset();
  }

  /**
   * SAFETY (rule 6): production must never serve the demo dataset by accident.
   * @throws DemoDataGuardError when the active dataset is demo, the process runs in
   * production and `ALLOW_DEMO_DATA` is not true.
   */
  public async assertStartupGuard(options: {
    isProduction: boolean;
    allowDemoData: boolean;
  }): Promise<InteractionDatasetEntity | null> {
    const active = await this.datasets.getActiveDataset();
    if (active?.kind === 'demo' && options.isProduction && !options.allowDemoData) {
      throw new DemoDataGuardError();
    }
    return active;
  }

  /**
   * Imports a dataset, replacing any earlier import with the same name and version.
   * Pairs are stored sorted, self-pairs are dropped, and severity and mechanism are kept
   * exactly as given.
   */
  public async importDataset(
    meta: {
      name: string;
      version: string;
      kind: DatasetKind;
      licenceStatus: LicenceStatus;
      activate: boolean;
    },
    pairs: Iterable<ImportPair> | AsyncIterable<ImportPair>,
  ): Promise<ImportSummary> {
    const dataset = await this.datasets.upsertDataset({
      name: meta.name,
      version: meta.version,
      kind: meta.kind,
      licenceStatus: meta.licenceStatus,
      importedAt: this.clock(),
    });
    let received = 0;
    let inserted = 0;
    let skippedSelfPairs = 0;
    let batch: PairInput[] = [];
    const flush = async (): Promise<void> => {
      inserted += await this.datasets.insertPairs(dataset.id, batch);
      batch = [];
    };
    for await (const pair of pairs) {
      received += 1;
      if (pair.ingredientA === pair.ingredientB) {
        skippedSelfPairs += 1;
        continue;
      }
      const ordered = orderPair(pair.ingredientA, pair.ingredientB);
      const swapped = ordered.a !== pair.ingredientA;
      batch.push({
        ingredientA: ordered.a,
        ingredientB: ordered.b,
        nameA: (swapped ? pair.nameB : pair.nameA) ?? null,
        nameB: (swapped ? pair.nameA : pair.nameB) ?? null,
        severity: pair.severity,
        mechanism: pair.mechanism ?? null,
        sourceRef: pair.sourceRef,
      });
      if (batch.length >= BATCH_SIZE) {
        await flush();
      }
    }
    await flush();
    const finished = await this.datasets.finishImport(dataset.id);
    if (meta.activate) {
      await this.datasets.activate(dataset.id);
    }
    return {
      dataset: { ...finished, active: meta.activate || finished.active },
      received,
      imported: finished.pairCount,
      skippedSelfPairs,
      duplicates: received - skippedSelfPairs - inserted,
    };
  }
}
