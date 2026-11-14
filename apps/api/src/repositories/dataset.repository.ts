import type { DatasetKind, LicenceStatus, Severity } from '@medmap/shared';
import { InteractionDatasetModel, InteractionPairModel } from '../models/interaction.model.js';
import type { InteractionDatasetDoc, InteractionPairDoc } from '../models/interaction.model.js';
import type { InteractionDatasetEntity, InteractionPairEntity } from '../types/entities.js';
import { oid } from './helpers.js';

function toDataset(doc: InteractionDatasetDoc): InteractionDatasetEntity {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    version: doc.version,
    kind: doc.kind,
    licenceStatus: doc.licenceStatus,
    importedAt: doc.importedAt,
    pairCount: doc.pairCount,
    active: doc.active,
  };
}

function toPair(doc: InteractionPairDoc): InteractionPairEntity {
  return {
    datasetId: doc.datasetId.toHexString(),
    ingredientA: doc.ingredientA,
    ingredientB: doc.ingredientB,
    nameA: doc.nameA,
    nameB: doc.nameB,
    severity: doc.severity,
    mechanism: doc.mechanism,
    sourceRef: doc.sourceRef,
  };
}

export interface PairInput {
  ingredientA: string;
  ingredientB: string;
  nameA: string | null;
  nameB: string | null;
  severity: Severity;
  mechanism: string | null;
  sourceRef: string;
}

/**
 * Datasets and their pairs. This class is the MongoDB-backed `InteractionSource`:
 * pair lookups hit the unique (datasetId, ingredientA, ingredientB) index.
 */
export class DatasetRepository {
  public async getActiveDataset(): Promise<InteractionDatasetEntity | null> {
    const doc = await InteractionDatasetModel.findOne({ active: true })
      .sort({ importedAt: -1 })
      .lean<InteractionDatasetDoc>();
    return doc ? toDataset(doc) : null;
  }

  public async findPairs(
    datasetId: string,
    pairs: { a: string; b: string }[],
  ): Promise<InteractionPairEntity[]> {
    if (pairs.length === 0) {
      return [];
    }
    const id = oid(datasetId);
    const results: InteractionPairEntity[] = [];
    // Each $or branch is an exact match on the unique index; batches keep queries small.
    for (let start = 0; start < pairs.length; start += 200) {
      const batch = pairs.slice(start, start + 200);
      const docs = await InteractionPairModel.find({
        $or: batch.map((pair) => ({ datasetId: id, ingredientA: pair.a, ingredientB: pair.b })),
      }).lean<InteractionPairDoc[]>();
      results.push(...docs.map(toPair));
    }
    return results;
  }

  public async knownIngredients(datasetId: string, ingredients: string[]): Promise<Set<string>> {
    if (ingredients.length === 0) {
      return new Set();
    }
    const id = oid(datasetId);
    const [asA, asB] = await Promise.all([
      InteractionPairModel.distinct('ingredientA', {
        datasetId: id,
        ingredientA: { $in: ingredients },
      }),
      InteractionPairModel.distinct('ingredientB', {
        datasetId: id,
        ingredientB: { $in: ingredients },
      }),
    ]);
    return new Set([...asA, ...asB]);
  }

  /** Creates the dataset record, or resets an existing one with the same name and version. */
  public async upsertDataset(input: {
    name: string;
    version: string;
    kind: DatasetKind;
    licenceStatus: LicenceStatus;
    importedAt: Date;
  }): Promise<InteractionDatasetEntity> {
    const doc = await InteractionDatasetModel.findOneAndUpdate(
      { name: input.name, version: input.version },
      {
        $set: {
          kind: input.kind,
          licenceStatus: input.licenceStatus,
          importedAt: input.importedAt,
          pairCount: 0,
        },
        $setOnInsert: { active: false },
      },
      { returnDocument: 'after', upsert: true },
    ).lean<InteractionDatasetDoc>();
    await InteractionPairModel.deleteMany({ datasetId: doc._id });
    return toDataset(doc);
  }

  /** Inserts pairs, ignoring duplicates. @returns how many rows were new. */
  public async insertPairs(datasetId: string, pairs: PairInput[]): Promise<number> {
    if (pairs.length === 0) {
      return 0;
    }
    const id = oid(datasetId);
    const result = await InteractionPairModel.bulkWrite(
      pairs.map((pair) => ({
        updateOne: {
          filter: { datasetId: id, ingredientA: pair.ingredientA, ingredientB: pair.ingredientB },
          update: { $setOnInsert: { ...pair, datasetId: id } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    return result.upsertedCount;
  }

  public async finishImport(datasetId: string): Promise<InteractionDatasetEntity> {
    const id = oid(datasetId);
    const pairCount = await InteractionPairModel.countDocuments({ datasetId: id });
    const doc = await InteractionDatasetModel.findOneAndUpdate(
      { _id: id },
      { $set: { pairCount } },
      { returnDocument: 'after' },
    ).lean<InteractionDatasetDoc>();
    if (!doc) {
      throw new Error('dataset disappeared during import');
    }
    return toDataset(doc);
  }

  /** Makes one dataset the active one and deactivates every other. */
  public async activate(datasetId: string): Promise<void> {
    const id = oid(datasetId);
    await InteractionDatasetModel.updateMany({ _id: { $ne: id } }, { $set: { active: false } });
    await InteractionDatasetModel.updateOne({ _id: id }, { $set: { active: true } });
  }
}
