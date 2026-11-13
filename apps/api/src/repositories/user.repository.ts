import { UserModel } from '../models/user.model.js';
import type { UserDoc } from '../models/user.model.js';
import type { UserEntity } from '../types/entities.js';
import { isDuplicateKeyError, oid } from './helpers.js';

function toEntity(doc: UserDoc): UserEntity {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    passwordHash: doc.passwordHash,
    emailVerifiedAt: doc.emailVerifiedAt,
    failedLoginCount: doc.failedLoginCount,
    lockedUntil: doc.lockedUntil,
    createdAt: doc.createdAt,
  };
}

export class UserRepository {
  /** @returns the new user, or null when the email is already registered. */
  public async create(input: { email: string; passwordHash: string }): Promise<UserEntity | null> {
    try {
      const doc = await UserModel.create({ email: input.email, passwordHash: input.passwordHash });
      return toEntity(doc.toObject());
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return null;
      }
      throw error;
    }
  }

  public async findByEmail(email: string): Promise<UserEntity | null> {
    const doc = await UserModel.findOne({ email: email }).lean<UserDoc>();
    return doc ? toEntity(doc) : null;
  }

  public async findById(id: string): Promise<UserEntity | null> {
    const doc = await UserModel.findById(oid(id)).lean<UserDoc>();
    return doc ? toEntity(doc) : null;
  }

  public async findByIds(ids: string[]): Promise<UserEntity[]> {
    const docs = await UserModel.find({ _id: { $in: ids.map(oid) } }).lean<UserDoc[]>();
    return docs.map(toEntity);
  }

  /** Counts a failed sign-in and locks the account when `lockUntil` is given. */
  public async recordLoginFailure(id: string, lockUntil: Date | null): Promise<void> {
    await UserModel.updateOne(
      { _id: oid(id) },
      lockUntil === null
        ? { $inc: { failedLoginCount: 1 } }
        : { $set: { lockedUntil: lockUntil, failedLoginCount: 0 } },
    );
  }

  public async clearLoginFailures(id: string): Promise<void> {
    await UserModel.updateOne(
      { _id: oid(id) },
      { $set: { failedLoginCount: 0, lockedUntil: null } },
    );
  }

  public async markEmailVerified(id: string, at: Date): Promise<void> {
    await UserModel.updateOne({ _id: oid(id) }, { $set: { emailVerifiedAt: at } });
  }

  public async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await UserModel.updateOne(
      { _id: oid(id) },
      { $set: { passwordHash, failedLoginCount: 0, lockedUntil: null } },
    );
  }

  public async delete(id: string): Promise<void> {
    await UserModel.deleteOne({ _id: oid(id) });
  }
}
