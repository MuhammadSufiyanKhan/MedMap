import type {
  CreateMedicationRequest,
  MedicationListQuery,
  NormalizeQuery,
  ProfileParams,
  UpdateMedicationRequest,
} from '@medmap/shared';
import { API_PREFIX } from '../config/constants.js';
import { toMedicationDto } from '../dto/mappers.js';
import { uploadedImages } from '../utils/upload-files.js';
import type { LabelExtractionService } from '../services/label-extraction.service.js';
import type { MedicationService } from '../services/medication.service.js';
import type { NormalizationService } from '../services/normalization.service.js';
import type { Handler } from '../utils/http.js';

interface MedicationParams {
  profileId: string;
  medicationId: string;
}

/** HTTP handlers for medicines and name lookup. */
export class MedicationController {
  public constructor(
    private readonly medications: MedicationService,
    private readonly normalization: NormalizationService,
    private readonly labels: LabelExtractionService,
  ) {}

  public list: Handler<ProfileParams, MedicationListQuery, unknown> = async (ctx) => {
    const page = await this.medications.list(ctx.userId, ctx.params.profileId, ctx.query);
    return {
      status: 200,
      body: { items: page.items.map(toMedicationDto), nextCursor: page.nextCursor },
    };
  };

  public create: Handler<ProfileParams, unknown, CreateMedicationRequest> = async (ctx) => {
    const medication = await this.medications.create(ctx.userId, ctx.params.profileId, ctx.body);
    return {
      status: 201,
      body: toMedicationDto(medication),
      location: `${API_PREFIX}/profiles/${medication.profileId}/medications/${medication.id}`,
      version: medication.version,
    };
  };

  public get: Handler<MedicationParams, unknown, unknown> = async (ctx) => {
    const medication = await this.medications.get(
      ctx.userId,
      ctx.params.profileId,
      ctx.params.medicationId,
    );
    return { status: 200, body: toMedicationDto(medication), version: medication.version };
  };

  public update: Handler<MedicationParams, unknown, UpdateMedicationRequest> = async (ctx) => {
    const medication = await this.medications.update(
      ctx.userId,
      ctx.params.profileId,
      ctx.params.medicationId,
      ctx.expectedVersion,
      ctx.body,
    );
    return { status: 200, body: toMedicationDto(medication), version: medication.version };
  };

  public remove: Handler<MedicationParams, unknown, unknown> = async (ctx) => {
    await this.medications.delete(ctx.userId, ctx.params.profileId, ctx.params.medicationId);
    return { status: 204 };
  };

  public extractLabels: Handler<ProfileParams, unknown, unknown> = async (ctx) => {
    const result = await this.labels.extract(
      ctx.userId,
      ctx.params.profileId,
      uploadedImages(ctx.req.files),
    );
    return { status: 200, body: result };
  };

  public normalize: Handler<unknown, NormalizeQuery, unknown> = async (ctx) => {
    return { status: 200, body: await this.normalization.search(ctx.query.term) };
  };
}
