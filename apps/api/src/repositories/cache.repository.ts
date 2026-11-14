import { ExtractionUsageModel, NormalizationCacheModel } from '../models/cache.model.js';
import type { NormalizationCacheDoc } from '../models/cache.model.js';
import { oid } from './helpers.js';

/** Small key-value cache with expiry, used for name-lookup results. */
export class CacheRepository {
  public async get(key: string, now: Date): Promise<unknown> {
    const doc = await NormalizationCacheModel.findOne({
      key,
      expiresAt: { $gt: now },
    }).lean<NormalizationCacheDoc>();
    return doc ? doc.value : undefined;
  }

  public async set(key: string, value: unknown, expiresAt: Date): Promise<void> {
    await NormalizationCacheModel.updateOne(
      { key },
      { $set: { value, expiresAt } },
      { upsert: true },
    );
  }
}

/** Per-user daily counters for label extraction. */
export class ExtractionUsageRepository {
  /**
   * Adds `amount` to the user's count for `day` only if the result stays within `cap`.
   * @returns the new count, or null when the cap would be exceeded.
   */
  public async tryIncrement(
    userId: string,
    day: string,
    amount: number,
    cap: number,
    expiresAt: Date,
  ): Promise<number | null> {
    await ExtractionUsageModel.updateOne(
      { userId: oid(userId), day },
      { $setOnInsert: { count: 0, expiresAt } },
      { upsert: true },
    ).catch((error: unknown) => {
      // Two first requests of the day can race on the unique index; the document exists either way.
      if (!(
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      )) {
        throw error;
      }
    });
    const updated = await ExtractionUsageModel.findOneAndUpdate(
      { userId: oid(userId), day, count: { $lte: cap - amount } },
      { $inc: { count: amount } },
      { returnDocument: 'after' },
    ).lean<{ count: number }>();
    return updated ? updated.count : null;
  }

  public async count(userId: string, day: string): Promise<number> {
    const doc = await ExtractionUsageModel.findOne({ userId: oid(userId), day }).lean<{
      count: number;
    }>();
    return doc?.count ?? 0;
  }

  public async deleteAllForUser(userId: string): Promise<void> {
    await ExtractionUsageModel.deleteMany({ userId: oid(userId) });
  }
}
