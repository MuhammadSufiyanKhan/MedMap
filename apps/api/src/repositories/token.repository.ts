import { EmailTokenModel } from '../models/email-token.model.js';
import type { EmailTokenDoc } from '../models/email-token.model.js';
import { RefreshTokenModel } from '../models/refresh-token.model.js';
import type { RefreshTokenDoc } from '../models/refresh-token.model.js';
import type { EmailTokenEntity, EmailTokenPurpose, RefreshTokenEntity } from '../types/entities.js';
import { oid } from './helpers.js';

function toRefresh(doc: RefreshTokenDoc): RefreshTokenEntity {
  return {
    id: doc._id.toHexString(),
    userId: doc.userId.toHexString(),
    tokenHash: doc.tokenHash,
    family: doc.family,
    expiresAt: doc.expiresAt,
    revokedAt: doc.revokedAt,
  };
}

export class RefreshTokenRepository {
  public async create(input: {
    userId: string;
    tokenHash: string;
    family: string;
    expiresAt: Date;
  }): Promise<void> {
    await RefreshTokenModel.create({ ...input, userId: oid(input.userId) });
  }

  public async findByHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    const doc = await RefreshTokenModel.findOne({
      tokenHash: tokenHash,
    }).lean<RefreshTokenDoc>();
    return doc ? toRefresh(doc) : null;
  }

  /**
   * Revokes a token only if it is still live.
   * @returns false when it was already revoked, which signals token reuse to the caller.
   */
  public async revokeIfActive(id: string, at: Date): Promise<boolean> {
    const result = await RefreshTokenModel.updateOne(
      { _id: oid(id), revokedAt: null },
      { $set: { revokedAt: at } },
    );
    return result.modifiedCount === 1;
  }

  public async revokeFamily(family: string, at: Date): Promise<void> {
    await RefreshTokenModel.updateMany(
      { family: family, revokedAt: null },
      { $set: { revokedAt: at } },
    );
  }

  public async revokeAllForUser(userId: string, at: Date): Promise<void> {
    await RefreshTokenModel.updateMany(
      { userId: oid(userId), revokedAt: null },
      { $set: { revokedAt: at } },
    );
  }

  public async deleteAllForUser(userId: string): Promise<void> {
    await RefreshTokenModel.deleteMany({ userId: oid(userId) });
  }
}

function toEmailToken(doc: EmailTokenDoc): EmailTokenEntity {
  return {
    id: doc._id.toHexString(),
    userId: doc.userId.toHexString(),
    purpose: doc.purpose,
    tokenHash: doc.tokenHash,
    expiresAt: doc.expiresAt,
    usedAt: doc.usedAt,
  };
}

export class EmailTokenRepository {
  public async create(input: {
    userId: string;
    purpose: EmailTokenPurpose;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await EmailTokenModel.create({ ...input, userId: oid(input.userId) });
  }

  /** Atomically marks a live token as used and returns it, so a token works exactly once. */
  public async consume(
    tokenHash: string,
    purpose: EmailTokenPurpose,
    now: Date,
  ): Promise<EmailTokenEntity | null> {
    const doc = await EmailTokenModel.findOneAndUpdate(
      { tokenHash: tokenHash, purpose, usedAt: null, expiresAt: { $gt: now } },
      { $set: { usedAt: now } },
      { returnDocument: 'after' },
    ).lean<EmailTokenDoc>();
    return doc ? toEmailToken(doc) : null;
  }

  public async deleteAllForUser(userId: string): Promise<void> {
    await EmailTokenModel.deleteMany({ userId: oid(userId) });
  }
}
