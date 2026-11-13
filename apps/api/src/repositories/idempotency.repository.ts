import { IdempotencyRecordModel } from '../models/idempotency-record.model.js';
import type { IdempotencyRecordDoc } from '../models/idempotency-record.model.js';
import type { IdempotencyRecordEntity } from '../types/entities.js';
import { isDuplicateKeyError, oid } from './helpers.js';

export class IdempotencyRepository {
  /** @returns true when the key was reserved, false when it already exists. */
  public async reserve(input: {
    userId: string;
    key: string;
    requestHash: string;
    expiresAt: Date;
  }): Promise<boolean> {
    try {
      await IdempotencyRecordModel.create({ ...input, userId: oid(input.userId), response: null });
      return true;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return false;
      }
      throw error;
    }
  }

  public async find(userId: string, key: string): Promise<IdempotencyRecordEntity | null> {
    const doc = await IdempotencyRecordModel.findOne({
      userId: oid(userId),
      key: key,
    }).lean<IdempotencyRecordDoc>();
    if (!doc) {
      return null;
    }
    return {
      userId: doc.userId.toHexString(),
      key: doc.key,
      requestHash: doc.requestHash,
      response: doc.response,
    };
  }

  public async saveResponse(
    userId: string,
    key: string,
    response: NonNullable<IdempotencyRecordEntity['response']>,
  ): Promise<void> {
    await IdempotencyRecordModel.updateOne(
      { userId: oid(userId), key: key },
      { $set: { response } },
    );
  }

  public async release(userId: string, key: string): Promise<void> {
    await IdempotencyRecordModel.deleteOne({ userId: oid(userId), key: key, response: null });
  }

  public async deleteAllForUser(userId: string): Promise<void> {
    await IdempotencyRecordModel.deleteMany({ userId: oid(userId) });
  }
}
