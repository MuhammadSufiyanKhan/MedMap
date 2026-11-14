import { MAX_LABEL_IMAGE_BYTES, MAX_LABEL_IMAGES } from '@medmap/shared';
import type { AppConfig as PublicAppConfig, ProfileParams } from '@medmap/shared';
import { API_PREFIX } from '../config/constants.js';
import { toDatasetInfoDto } from '../dto/mappers.js';
import type { DatasetService } from '../services/dataset.service.js';
import type { InteractionCheckService } from '../services/interaction-check.service.js';
import type { Handler } from '../utils/http.js';

/** HTTP handlers for interaction checks and the public app configuration. */
export class InteractionController {
  public constructor(
    private readonly checks: InteractionCheckService,
    private readonly datasets: DatasetService,
    private readonly extraction: { enabled: boolean; provider: string | null },
  ) {}

  public run: Handler<ProfileParams, unknown, unknown> = async (ctx) => {
    const check = await this.checks.run(ctx.userId, ctx.params.profileId);
    return {
      status: 201,
      body: check,
      location: `${API_PREFIX}/profiles/${check.profileId}/interaction-checks/latest`,
    };
  };

  public latest: Handler<ProfileParams, unknown, unknown> = async (ctx) => {
    return { status: 200, body: await this.checks.latest(ctx.userId, ctx.params.profileId) };
  };

  public appConfig: Handler<unknown, unknown, unknown> = async () => {
    const dataset = await this.datasets.getActive();
    const body: PublicAppConfig = {
      dataset: dataset === null ? null : toDatasetInfoDto(dataset),
      demoMode: dataset?.kind === 'demo',
      labelExtraction: {
        enabled: this.extraction.enabled,
        provider: this.extraction.enabled ? this.extraction.provider : null,
        maxImages: MAX_LABEL_IMAGES,
        maxImageBytes: MAX_LABEL_IMAGE_BYTES,
      },
    };
    return { status: 200, body };
  };
}
