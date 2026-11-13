import type { InvitableRole } from '@medmap/shared';
import { InviteModel } from '../models/invite.model.js';
import type { InviteDoc } from '../models/invite.model.js';
import type { InviteEntity } from '../types/entities.js';
import { idCursorFilter, oid, toPage } from './helpers.js';
import type { PageRequest, PageResult } from './helpers.js';

function toEntity(doc: InviteDoc): InviteEntity {
  return {
    id: doc._id.toHexString(),
    profileId: doc.profileId.toHexString(),
    email: doc.email,
    role: doc.role,
    tokenHash: doc.tokenHash,
    invitedBy: doc.invitedBy.toHexString(),
    expiresAt: doc.expiresAt,
    acceptedAt: doc.acceptedAt,
    createdAt: doc.createdAt,
  };
}

export class InviteRepository {
  public async create(input: {
    profileId: string;
    email: string;
    role: InvitableRole;
    tokenHash: string;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<InviteEntity> {
    const doc = await InviteModel.create({
      ...input,
      profileId: oid(input.profileId),
      invitedBy: oid(input.invitedBy),
    });
    return toEntity(doc.toObject());
  }

  public async findByHash(tokenHash: string): Promise<InviteEntity | null> {
    const doc = await InviteModel.findOne({ tokenHash: tokenHash }).lean<InviteDoc>();
    return doc ? toEntity(doc) : null;
  }

  public async findInProfile(profileId: string, inviteId: string): Promise<InviteEntity | null> {
    const doc = await InviteModel.findOne({
      _id: oid(inviteId),
      profileId: oid(profileId),
    }).lean<InviteDoc>();
    return doc ? toEntity(doc) : null;
  }

  public async listForProfile(
    profileId: string,
    page: PageRequest,
  ): Promise<PageResult<InviteEntity>> {
    const docs = await InviteModel.find({
      profileId: oid(profileId),
      ...idCursorFilter(page.cursor),
    })
      .sort({ _id: -1 })
      .limit(page.limit + 1)
      .lean<InviteDoc[]>();
    return toPage(docs, page.limit, toEntity, (doc) => ({ value: 0, id: doc._id.toHexString() }));
  }

  public async allForProfile(profileId: string): Promise<InviteEntity[]> {
    const docs = await InviteModel.find({ profileId: oid(profileId) }).lean<InviteDoc[]>();
    return docs.map(toEntity);
  }

  public async countPending(profileId: string, now: Date): Promise<number> {
    return InviteModel.countDocuments({
      profileId: oid(profileId),
      acceptedAt: null,
      expiresAt: { $gt: now },
    });
  }

  /** Marks a live invite as accepted exactly once. */
  public async markAccepted(id: string, now: Date): Promise<boolean> {
    const result = await InviteModel.updateOne(
      { _id: oid(id), acceptedAt: null, expiresAt: { $gt: now } },
      { $set: { acceptedAt: now } },
    );
    return result.modifiedCount === 1;
  }

  public async delete(id: string): Promise<void> {
    await InviteModel.deleteOne({ _id: oid(id) });
  }

  public async deleteAllForProfile(profileId: string): Promise<void> {
    await InviteModel.deleteMany({ profileId: oid(profileId) });
  }

  public async deleteAllForEmail(email: string): Promise<void> {
    await InviteModel.deleteMany({ email: email });
  }
}
