import { ProfileModel } from '../models/profile.model.js';
import type { ProfileDoc } from '../models/profile.model.js';
import type { ProfileEntity } from '../types/entities.js';
import { oid } from './helpers.js';

function toEntity(doc: ProfileDoc): ProfileEntity {
  return {
    id: doc._id.toHexString(),
    ownerId: doc.ownerId.toHexString(),
    displayName: doc.displayName,
    birthYear: doc.birthYear,
    notes: doc.notes,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export interface ProfileChanges {
  displayName?: string | undefined;
  birthYear?: number | null | undefined;
  notes?: string | null | undefined;
}

export class ProfileRepository {
  public async create(input: {
    ownerId: string;
    displayName: string;
    birthYear: number | null;
    notes: string | null;
  }): Promise<ProfileEntity> {
    const doc = await ProfileModel.create({ ...input, ownerId: oid(input.ownerId) });
    return toEntity(doc.toObject());
  }

  public async findById(id: string): Promise<ProfileEntity | null> {
    const doc = await ProfileModel.findById(oid(id)).lean<ProfileDoc>();
    return doc ? toEntity(doc) : null;
  }

  public async findByIds(ids: string[]): Promise<ProfileEntity[]> {
    const docs = await ProfileModel.find({ _id: { $in: ids.map(oid) } }).lean<ProfileDoc[]>();
    return docs.map(toEntity);
  }

  public async findByOwner(ownerId: string): Promise<ProfileEntity[]> {
    const docs = await ProfileModel.find({ ownerId: oid(ownerId) }).lean<ProfileDoc[]>();
    return docs.map(toEntity);
  }

  public async countByOwner(ownerId: string): Promise<number> {
    return ProfileModel.countDocuments({ ownerId: oid(ownerId) });
  }

  /**
   * Applies changes only if the stored version still equals `expectedVersion`.
   * @returns the updated profile, or null when the version did not match (stale write).
   */
  public async updateIfVersion(
    id: string,
    expectedVersion: number,
    changes: ProfileChanges,
  ): Promise<ProfileEntity | null> {
    const set: Record<string, string | number | null> = {};
    if (changes.displayName !== undefined) set.displayName = changes.displayName;
    if (changes.birthYear !== undefined) set.birthYear = changes.birthYear;
    if (changes.notes !== undefined) set.notes = changes.notes;
    const doc = await ProfileModel.findOneAndUpdate(
      { _id: oid(id), version: expectedVersion },
      { $set: set, $inc: { version: 1 } },
      { returnDocument: 'after' },
    ).lean<ProfileDoc>();
    return doc ? toEntity(doc) : null;
  }

  public async delete(id: string): Promise<void> {
    await ProfileModel.deleteOne({ _id: oid(id) });
  }
}
