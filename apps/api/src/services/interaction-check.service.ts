import { createHash } from 'node:crypto';
import type { DatasetInfo, InteractionCheck } from '@medmap/shared';
import { buildCandidatePairs, collectIngredients, runInteractionEngine } from '../engine/engine.js';
import type { EngineMedication, InteractionSource } from '../engine/types.js';
import type {
  InteractionCheckRepository,
  StoredCheck,
} from '../repositories/interaction-check.repository.js';
import type { MedicationRepository } from '../repositories/medication.repository.js';
import type { InteractionDatasetEntity, MedicationEntity } from '../types/entities.js';
import { NotFoundError, ServiceUnavailableError } from '../utils/errors.js';
import type { AccessService } from './access.service.js';
import type { AuditService } from './audit.service.js';

/** How many past checks are kept per profile. Older ones are deleted (data minimisation). */
const CHECKS_KEPT_PER_PROFILE = 5;

function toDatasetInfo(dataset: InteractionDatasetEntity): DatasetInfo {
  return {
    id: dataset.id,
    name: dataset.name,
    version: dataset.version,
    kind: dataset.kind,
    licenceStatus: dataset.licenceStatus,
    importedAt: dataset.importedAt.toISOString(),
    pairCount: dataset.pairCount,
  };
}

/**
 * Identifies the exact input of a check: the dataset and each active medicine's name,
 * strength and ingredients. If it differs from the stored one, the stored check is stale.
 */
function fingerprint(datasetId: string, medications: MedicationEntity[]): string {
  const parts = medications
    .map((m) =>
      [m.id, m.displayName, m.strengthText ?? '', m.kind, ...m.ingredientRxcuis].join('\u001f'),
    )
    .sort();
  return createHash('sha256')
    .update([datasetId, ...parts].join('\u001e'))
    .digest('hex');
}

export class InteractionCheckService {
  public constructor(
    private readonly source: InteractionSource,
    private readonly medications: MedicationRepository,
    private readonly checks: InteractionCheckRepository,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Checks every pair of the profile's active medicines against the active dataset and
   * stores the result.
   * @throws ServiceUnavailableError when no dataset has been imported.
   */
  public async run(userId: string, profileId: string): Promise<InteractionCheck> {
    await this.access.require(profileId, userId, 'interaction_check.run');
    const dataset = await this.requireDataset();
    const active = await this.medications.allForProfile(profileId, 'active');
    const engineInput: EngineMedication[] = active.map((medication) => ({
      id: medication.id,
      displayName: medication.displayName,
      strengthText: medication.strengthText,
      kind: medication.kind,
      ingredientRxcuis: medication.ingredientRxcuis,
    }));
    const [foundPairs, known] = await Promise.all([
      this.source.findPairs(dataset.id, buildCandidatePairs(engineInput)),
      this.source.knownIngredients(dataset.id, collectIngredients(engineInput)),
    ]);
    const result = runInteractionEngine(engineInput, foundPairs, known);
    const stored = await this.checks.create({
      profileId,
      createdBy: userId,
      fingerprint: fingerprint(dataset.id, active),
      result: { datasetInfo: toDatasetInfo(dataset), ...result },
    });
    await this.checks.prune(profileId, CHECKS_KEPT_PER_PROFILE);
    await this.audit.record({
      actorId: userId,
      profileId,
      action: 'interaction_check.run',
      target: { type: 'interaction_check', id: stored.id },
    });
    return this.toView(stored, false);
  }

  /** @throws NotFoundError when the profile has never been checked. */
  public async latest(userId: string, profileId: string): Promise<InteractionCheck> {
    await this.access.require(profileId, userId, 'interaction_check.read');
    const view = await this.latestOrNull(profileId);
    if (view === null) {
      throw new NotFoundError('No check has been run for this profile yet.');
    }
    return view;
  }

  /** Latest check without an access check. Callers must have authorised the read. */
  public async latestOrNull(profileId: string): Promise<InteractionCheck | null> {
    const stored = await this.checks.latestForProfile(profileId);
    if (stored === null) {
      return null;
    }
    const dataset = await this.source.getActiveDataset();
    const active = await this.medications.allForProfile(profileId, 'active');
    const stale = dataset === null || fingerprint(dataset.id, active) !== stored.fingerprint;
    return this.toView(stored, stale);
  }

  private async requireDataset(): Promise<InteractionDatasetEntity> {
    const dataset = await this.source.getActiveDataset();
    if (dataset === null) {
      throw new ServiceUnavailableError(
        'No interaction dataset is loaded, so nothing can be checked right now.',
        'no-dataset',
      );
    }
    return dataset;
  }

  private toView(stored: StoredCheck, stale: boolean): InteractionCheck {
    return {
      id: stored.id,
      profileId: stored.profileId,
      createdAt: stored.createdAt.toISOString(),
      ...stored.result,
      stale,
    };
  }
}
