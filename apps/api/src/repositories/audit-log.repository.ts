import { AuditLogModel } from '../models/audit-log.model.js';
import type { AuditLogDoc } from '../models/audit-log.model.js';
import type { AuditEntryInput, AuditLogEntity } from '../types/entities.js';
import { idCursorFilter, oid, toPage } from './helpers.js';
import type { PageRequest, PageResult } from './helpers.js';

function toEntity(doc: AuditLogDoc): AuditLogEntity {
  return {
    id: doc._id.toHexString(),
    actorId: doc.actorId ? doc.actorId.toHexString() : null,
    profileId: doc.profileId ? doc.profileId.toHexString() : null,
    action: doc.action,
    target: doc.target ? { type: doc.target.type, id: doc.target.id } : null,
    at: doc.at,
  };
}

/**
 * Append-only store. There is deliberately no method to edit an entry. The two erasure
 * methods exist only for account and profile deletion.
 */
export class AuditLogRepository {
  public async append(entry: AuditEntryInput, at: Date): Promise<void> {
    await AuditLogModel.create({
      actorId: entry.actorId === null ? null : oid(entry.actorId),
      profileId: entry.profileId ? oid(entry.profileId) : null,
      action: entry.action,
      target: entry.target ?? null,
      at,
    });
  }

  public async listForProfile(
    profileId: string,
    page: PageRequest,
  ): Promise<PageResult<AuditLogEntity>> {
    const docs = await AuditLogModel.find({
      profileId: oid(profileId),
      ...idCursorFilter(page.cursor),
    })
      .sort({ _id: -1 })
      .limit(page.limit + 1)
      .lean<AuditLogDoc[]>();
    return toPage(docs, page.limit, toEntity, (doc) => ({ value: 0, id: doc._id.toHexString() }));
  }

  public async allForActor(actorId: string, limit: number): Promise<AuditLogEntity[]> {
    const docs = await AuditLogModel.find({ actorId: oid(actorId) })
      .sort({ _id: -1 })
      .limit(limit)
      .lean<AuditLogDoc[]>();
    return docs.map(toEntity);
  }

  /** Erasure: removes every entry of a deleted profile. */
  public async eraseForProfile(profileId: string): Promise<void> {
    await AuditLogModel.deleteMany({ profileId: oid(profileId) });
  }

  /**
   * Erasure: removes a deleted user's own account entries and detaches them from entries
   * in profiles that belong to other people, so those owners keep their history.
   */
  public async eraseActor(actorId: string): Promise<void> {
    await AuditLogModel.deleteMany({ actorId: oid(actorId), profileId: null });
    await AuditLogModel.updateMany({ actorId: oid(actorId) }, { $set: { actorId: null } });
  }
}
