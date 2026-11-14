import { InteractionCheckModel } from '../models/interaction.model.js';
import type { InteractionCheckDoc, StoredCheckResult } from '../models/interaction.model.js';
import { oid } from './helpers.js';

export type { StoredCheckResult };

export interface StoredCheck {
  id: string;
  profileId: string;
  fingerprint: string;
  result: StoredCheckResult;
  createdAt: Date;
}

function toStored(doc: InteractionCheckDoc): StoredCheck {
  return {
    id: doc._id.toHexString(),
    profileId: doc.profileId.toHexString(),
    fingerprint: doc.fingerprint,
    result: doc.result,
    createdAt: doc.createdAt,
  };
}

export class InteractionCheckRepository {
  public async create(input: {
    profileId: string;
    createdBy: string;
    fingerprint: string;
    result: StoredCheckResult;
  }): Promise<StoredCheck> {
    const doc = await InteractionCheckModel.create({
      profileId: oid(input.profileId),
      createdBy: oid(input.createdBy),
      fingerprint: input.fingerprint,
      result: input.result,
    });
    return toStored(doc.toObject());
  }

  public async latestForProfile(profileId: string): Promise<StoredCheck | null> {
    const doc = await InteractionCheckModel.findOne({ profileId: oid(profileId) })
      .sort({ _id: -1 })
      .lean<InteractionCheckDoc>();
    return doc ? toStored(doc) : null;
  }

  /** Keeps only the newest `keep` checks of a profile (data minimisation). */
  public async prune(profileId: string, keep: number): Promise<void> {
    const old = await InteractionCheckModel.find({ profileId: oid(profileId) })
      .sort({ _id: -1 })
      .skip(keep)
      .select({ _id: 1 })
      .lean<{ _id: InteractionCheckDoc['_id'] }[]>();
    if (old.length > 0) {
      await InteractionCheckModel.deleteMany({ _id: { $in: old.map((doc) => doc._id) } });
    }
  }

  public async deleteAllForProfile(profileId: string): Promise<void> {
    await InteractionCheckModel.deleteMany({ profileId: oid(profileId) });
  }
}
