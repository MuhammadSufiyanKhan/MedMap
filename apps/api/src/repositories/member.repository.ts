import type { InvitableRole, ProfileRole } from '@medmap/shared';
import { ProfileMemberModel } from '../models/profile-member.model.js';
import type { ProfileMemberDoc } from '../models/profile-member.model.js';
import type { ProfileMemberEntity } from '../types/entities.js';
import { idCursorFilter, isDuplicateKeyError, oid, toPage } from './helpers.js';
import type { PageRequest, PageResult } from './helpers.js';

function toEntity(doc: ProfileMemberDoc): ProfileMemberEntity {
  return {
    id: doc._id.toHexString(),
    profileId: doc.profileId.toHexString(),
    userId: doc.userId.toHexString(),
    role: doc.role,
    invitedBy: doc.invitedBy ? doc.invitedBy.toHexString() : null,
    version: doc.version,
    createdAt: doc.createdAt,
  };
}

export class MemberRepository {
  /** @returns the membership, or null when the user is already a member. */
  public async create(input: {
    profileId: string;
    userId: string;
    role: ProfileRole;
    invitedBy: string | null;
  }): Promise<ProfileMemberEntity | null> {
    try {
      const doc = await ProfileMemberModel.create({
        profileId: oid(input.profileId),
        userId: oid(input.userId),
        role: input.role,
        invitedBy: input.invitedBy === null ? null : oid(input.invitedBy),
      });
      return toEntity(doc.toObject());
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return null;
      }
      throw error;
    }
  }

  public async find(profileId: string, userId: string): Promise<ProfileMemberEntity | null> {
    const doc = await ProfileMemberModel.findOne({
      profileId: oid(profileId),
      userId: oid(userId),
    }).lean<ProfileMemberDoc>();
    return doc ? toEntity(doc) : null;
  }

  public async listForUser(
    userId: string,
    page: PageRequest,
  ): Promise<PageResult<ProfileMemberEntity>> {
    const docs = await ProfileMemberModel.find({
      userId: oid(userId),
      ...idCursorFilter(page.cursor),
    })
      .sort({ _id: -1 })
      .limit(page.limit + 1)
      .lean<ProfileMemberDoc[]>();
    return toPage(docs, page.limit, toEntity, (doc) => ({ value: 0, id: doc._id.toHexString() }));
  }

  public async allForUser(userId: string): Promise<ProfileMemberEntity[]> {
    const docs = await ProfileMemberModel.find({ userId: oid(userId) }).lean<ProfileMemberDoc[]>();
    return docs.map(toEntity);
  }

  public async listForProfile(
    profileId: string,
    page: PageRequest,
  ): Promise<PageResult<ProfileMemberEntity>> {
    const docs = await ProfileMemberModel.find({
      profileId: oid(profileId),
      ...idCursorFilter(page.cursor),
    })
      .sort({ _id: -1 })
      .limit(page.limit + 1)
      .lean<ProfileMemberDoc[]>();
    return toPage(docs, page.limit, toEntity, (doc) => ({ value: 0, id: doc._id.toHexString() }));
  }

  public async allForProfile(profileId: string): Promise<ProfileMemberEntity[]> {
    const docs = await ProfileMemberModel.find({
      profileId: oid(profileId),
    }).lean<ProfileMemberDoc[]>();
    return docs.map(toEntity);
  }

  /** @returns the updated membership, or null on a version mismatch. Owners are never changed. */
  public async updateRoleIfVersion(
    profileId: string,
    userId: string,
    expectedVersion: number,
    role: InvitableRole,
  ): Promise<ProfileMemberEntity | null> {
    const doc = await ProfileMemberModel.findOneAndUpdate(
      {
        profileId: oid(profileId),
        userId: oid(userId),
        version: expectedVersion,
        role: { $ne: 'owner' },
      },
      { $set: { role }, $inc: { version: 1 } },
      { returnDocument: 'after' },
    ).lean<ProfileMemberDoc>();
    return doc ? toEntity(doc) : null;
  }

  public async delete(profileId: string, userId: string): Promise<void> {
    await ProfileMemberModel.deleteOne({ profileId: oid(profileId), userId: oid(userId) });
  }

  public async deleteAllForProfile(profileId: string): Promise<void> {
    await ProfileMemberModel.deleteMany({ profileId: oid(profileId) });
  }

  public async deleteAllForUser(userId: string): Promise<void> {
    await ProfileMemberModel.deleteMany({ userId: oid(userId) });
  }
}
