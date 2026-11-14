import type {
  CreateMedicationRequest,
  MedicationListQuery,
  UpdateMedicationRequest,
} from '@medmap/shared';
import { MAX_ACTIVE_MEDICATIONS_PER_PROFILE } from '../config/constants.js';
import type { PageResult } from '../repositories/helpers.js';
import type {
  MedicationChanges,
  MedicationRepository,
} from '../repositories/medication.repository.js';
import type { MedicationEntity } from '../types/entities.js';
import {
  ConflictError,
  NotFoundError,
  PreconditionFailedError,
  ValidationError,
} from '../utils/errors.js';
import type { AccessService } from './access.service.js';
import type { AuditService } from './audit.service.js';
import type { NormalizationService } from './normalization.service.js';

interface IngredientFields {
  rxcui: string | null;
  ingredientRxcuis: string[];
  ingredientNames: string[];
}

/** Medicines on a profile. Ingredients are always derived on the server from the concept id. */
export class MedicationService {
  public constructor(
    private readonly medications: MedicationRepository,
    private readonly normalization: NormalizationService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  public async list(
    userId: string,
    profileId: string,
    query: MedicationListQuery,
  ): Promise<PageResult<MedicationEntity>> {
    await this.access.require(profileId, userId, 'medication.read');
    return this.medications.list(profileId, query);
  }

  public async get(
    userId: string,
    profileId: string,
    medicationId: string,
  ): Promise<MedicationEntity> {
    await this.access.require(profileId, userId, 'medication.read');
    const medication = await this.medications.findInProfile(profileId, medicationId);
    if (medication === null) {
      throw new NotFoundError('Medicine not found.');
    }
    return medication;
  }

  /**
   * @throws ValidationError when `rxcui` is not a known concept.
   * @throws ConflictError when the profile already has the maximum number of active medicines.
   * @throws ServiceUnavailableError when the name lookup is down; the client can retry
   * without `rxcui` to save the medicine as "could not check".
   */
  public async create(
    userId: string,
    profileId: string,
    input: CreateMedicationRequest,
  ): Promise<MedicationEntity> {
    await this.access.require(profileId, userId, 'medication.write');
    if ((await this.medications.countActive(profileId)) >= MAX_ACTIVE_MEDICATIONS_PER_PROFILE) {
      throw new ConflictError(
        `A profile can hold up to ${String(MAX_ACTIVE_MEDICATIONS_PER_PROFILE)} active medicines.`,
        'medication-limit-reached',
      );
    }
    const ingredients = await this.resolveIngredients(input.rxcui ?? null);
    const medication = await this.medications.create({
      profileId,
      displayName: input.displayName,
      strengthText: input.strengthText ?? null,
      kind: input.kind,
      source: input.source,
      createdBy: userId,
      ...ingredients,
    });
    await this.audit.record({
      actorId: userId,
      profileId,
      action: 'medication.created',
      target: { type: 'medication', id: medication.id },
    });
    return medication;
  }

  /** @throws PreconditionFailedError when `expectedVersion` is stale. */
  public async update(
    userId: string,
    profileId: string,
    medicationId: string,
    expectedVersion: number,
    input: UpdateMedicationRequest,
  ): Promise<MedicationEntity> {
    await this.access.require(profileId, userId, 'medication.write');
    const existing = await this.medications.findInProfile(profileId, medicationId);
    if (existing === null) {
      throw new NotFoundError('Medicine not found.');
    }
    const changes: MedicationChanges = {
      displayName: input.displayName,
      strengthText: input.strengthText,
      kind: input.kind,
      status: input.status,
    };
    if (input.rxcui !== undefined && input.rxcui !== existing.rxcui) {
      Object.assign(changes, await this.resolveIngredients(input.rxcui));
    }
    const updated = await this.medications.updateIfVersion(
      profileId,
      medicationId,
      expectedVersion,
      changes,
    );
    if (updated === null) {
      throw new PreconditionFailedError();
    }
    await this.audit.record({
      actorId: userId,
      profileId,
      action: 'medication.updated',
      target: { type: 'medication', id: medicationId },
    });
    return updated;
  }

  public async delete(userId: string, profileId: string, medicationId: string): Promise<void> {
    await this.access.require(profileId, userId, 'medication.write');
    if (!(await this.medications.delete(profileId, medicationId))) {
      throw new NotFoundError('Medicine not found.');
    }
    await this.audit.record({
      actorId: userId,
      profileId,
      action: 'medication.deleted',
      target: { type: 'medication', id: medicationId },
    });
  }

  private async resolveIngredients(rxcui: string | null): Promise<IngredientFields> {
    if (rxcui === null) {
      return { rxcui: null, ingredientRxcuis: [], ingredientNames: [] };
    }
    const concept = await this.normalization.resolve(rxcui);
    if (concept === null) {
      throw new ValidationError([
        { path: 'body.rxcui', message: 'This is not a known medicine id. Pick a match again.' },
      ]);
    }
    return {
      rxcui: concept.rxcui,
      ingredientRxcuis: concept.ingredients.map((ingredient) => ingredient.rxcui),
      ingredientNames: concept.ingredients.map((ingredient) => ingredient.name),
    };
  }
}
