import type {
  MedicationKind,
  MedicationSort,
  MedicationSource,
  MedicationStatus,
} from '@medmap/shared';
import { MedicationModel } from '../models/medication.model.js';
import type { MedicationDoc } from '../models/medication.model.js';
import type { MedicationEntity } from '../types/entities.js';
import { decodeCursor } from '../utils/cursor.js';
import { oid, toPage } from './helpers.js';
import type { PageRequest, PageResult } from './helpers.js';

function toEntity(doc: MedicationDoc): MedicationEntity {
  return {
    id: doc._id.toHexString(),
    profileId: doc.profileId.toHexString(),
    displayName: doc.displayName,
    rxcui: doc.rxcui,
    ingredientRxcuis: doc.ingredientRxcuis,
    ingredientNames: doc.ingredientNames,
    strengthText: doc.strengthText,
    kind: doc.kind,
    source: doc.source,
    status: doc.status,
    createdBy: doc.createdBy.toHexString(),
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export interface MedicationCreate {
  profileId: string;
  displayName: string;
  rxcui: string | null;
  ingredientRxcuis: string[];
  ingredientNames: string[];
  strengthText: string | null;
  kind: MedicationKind;
  source: MedicationSource;
  createdBy: string;
}

export interface MedicationChanges {
  displayName?: string | undefined;
  rxcui?: string | null | undefined;
  ingredientRxcuis?: string[] | undefined;
  ingredientNames?: string[] | undefined;
  strengthText?: string | null | undefined;
  kind?: MedicationKind | undefined;
  status?: MedicationStatus | undefined;
}

export interface MedicationListOptions extends PageRequest {
  status?: MedicationStatus | undefined;
  sort: MedicationSort;
}

type Filter = Record<string, unknown>;

/** Builds the keyset condition for the whitelisted sort orders. */
function keysetFilter(sort: MedicationSort, cursor: string | undefined): Filter {
  if (cursor === undefined) {
    return {};
  }
  const position = decodeCursor(cursor);
  const id = oid(position.id);
  if (sort === 'displayName') {
    const name = String(position.value);
    return { $or: [{ displayName: { $gt: name } }, { displayName: name, _id: { $gt: id } }] };
  }
  return sort === 'createdAt' ? { _id: { $gt: id } } : { _id: { $lt: id } };
}

export class MedicationRepository {
  public async create(input: MedicationCreate): Promise<MedicationEntity> {
    const doc = await MedicationModel.create({
      ...input,
      profileId: oid(input.profileId),
      createdBy: oid(input.createdBy),
    });
    return toEntity(doc.toObject());
  }

  public async findInProfile(profileId: string, id: string): Promise<MedicationEntity | null> {
    const doc = await MedicationModel.findOne({
      _id: oid(id),
      profileId: oid(profileId),
    }).lean<MedicationDoc>();
    return doc ? toEntity(doc) : null;
  }

  public async list(
    profileId: string,
    options: MedicationListOptions,
  ): Promise<PageResult<MedicationEntity>> {
    const filter: Filter = {
      profileId: oid(profileId),
      ...(options.status === undefined ? {} : { status: options.status }),
      ...keysetFilter(options.sort, options.cursor),
    };
    const order: Record<string, 1 | -1> =
      options.sort === 'displayName'
        ? { displayName: 1, _id: 1 }
        : { _id: options.sort === 'createdAt' ? 1 : -1 };
    const docs = await MedicationModel.find(filter)
      .sort(order)
      .limit(options.limit + 1)
      .lean<MedicationDoc[]>();
    return toPage(docs, options.limit, toEntity, (doc) => ({
      value: options.sort === 'displayName' ? doc.displayName : 0,
      id: doc._id.toHexString(),
    }));
  }

  public async allForProfile(
    profileId: string,
    status?: MedicationStatus,
  ): Promise<MedicationEntity[]> {
    const docs = await MedicationModel.find({
      profileId: oid(profileId),
      ...(status === undefined ? {} : { status }),
    })
      .sort({ _id: 1 })
      .lean<MedicationDoc[]>();
    return docs.map(toEntity);
  }

  public async countActive(profileId: string): Promise<number> {
    return MedicationModel.countDocuments({ profileId: oid(profileId), status: 'active' });
  }

  /** Active-medicine counts for several profiles in one query. */
  public async countActiveByProfile(profileIds: string[]): Promise<Map<string, number>> {
    const rows = await MedicationModel.aggregate<{ _id: { toHexString(): string }; count: number }>(
      [
        { $match: { profileId: { $in: profileIds.map(oid) }, status: 'active' } },
        { $group: { _id: '$profileId', count: { $sum: 1 } } },
      ],
    );
    return new Map(rows.map((row) => [row._id.toHexString(), row.count]));
  }

  /** @returns the updated medicine, or null when the version did not match. */
  public async updateIfVersion(
    profileId: string,
    id: string,
    expectedVersion: number,
    changes: MedicationChanges,
  ): Promise<MedicationEntity | null> {
    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) {
        set[key] = value;
      }
    }
    const doc = await MedicationModel.findOneAndUpdate(
      { _id: oid(id), profileId: oid(profileId), version: expectedVersion },
      { $set: set, $inc: { version: 1 } },
      { new: true },
    ).lean<MedicationDoc>();
    return doc ? toEntity(doc) : null;
  }

  public async delete(profileId: string, id: string): Promise<boolean> {
    const result = await MedicationModel.deleteOne({ _id: oid(id), profileId: oid(profileId) });
    return result.deletedCount === 1;
  }

  public async deleteAllForProfile(profileId: string): Promise<void> {
    await MedicationModel.deleteMany({ profileId: oid(profileId) });
  }
}
