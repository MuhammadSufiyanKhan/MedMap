import { LOW_CONFIDENCE_THRESHOLD, MAX_LABEL_IMAGES } from '@medmap/shared';
import type {
  ExtractedLabel,
  ExtractionFailureReason,
  LabelCandidate,
  LabelExtractionResponse,
  LabelMimeType,
} from '@medmap/shared';
import type { LabelExtractor } from '../integrations/label-extractor/extractor.js';
import type { ExtractionUsageRepository } from '../repositories/cache.repository.js';
import { addDays } from '../utils/clock.js';
import type { Clock } from '../utils/clock.js';
import {
  ServiceUnavailableError,
  TooManyRequestsError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../utils/errors.js';
import { sanitizeImage } from '../utils/image.js';
import type { Logger } from '../utils/logger.js';
import type { AccessService } from './access.service.js';
import type { AuditService } from './audit.service.js';

export interface LabelExtractionOptions {
  enabled: boolean;
  timeoutMs: number;
  dailyCap: number;
}

/**
 * Reads medicine names from label photos.
 *
 * Nothing is saved here: the result is a list of candidates the user must confirm or edit
 * in the app. Images exist only in memory for the length of the request; they are never
 * written to disk, to the database or to logs.
 */
export class LabelExtractionService {
  public constructor(
    private readonly extractor: LabelExtractor,
    private readonly usage: ExtractionUsageRepository,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly options: LabelExtractionOptions,
  ) {}

  public get providerName(): string {
    return this.extractor.name;
  }

  /**
   * @throws ServiceUnavailableError when label reading is switched off.
   * @throws ValidationError when no image, or too many, were sent.
   * @throws UnsupportedMediaTypeError when a file is not a JPEG, PNG or WebP image.
   * @throws TooManyRequestsError when the user's daily allowance is used up.
   */
  public async extract(
    userId: string,
    profileId: string,
    images: Buffer[],
  ): Promise<LabelExtractionResponse> {
    await this.access.require(profileId, userId, 'label_extraction.create');
    if (!this.options.enabled) {
      throw new ServiceUnavailableError(
        'Reading labels from photos is switched off. Type the medicine names instead.',
        'label-extraction-disabled',
      );
    }
    if (images.length === 0 || images.length > MAX_LABEL_IMAGES) {
      throw new ValidationError([
        { path: 'body.images', message: `Add between 1 and ${String(MAX_LABEL_IMAGES)} photos.` },
      ]);
    }

    // Validate every file before spending any allowance or calling the provider.
    const cleaned = [];
    for (const image of images) {
      cleaned.push(await sanitizeImage(image));
    }

    const now = this.clock();
    const day = now.toISOString().slice(0, 10);
    const count = await this.usage.tryIncrement(
      userId,
      day,
      cleaned.length,
      this.options.dailyCap,
      addDays(now, 2),
    );
    if (count === null) {
      const midnight = new Date(`${day}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000;
      throw new TooManyRequestsError(
        'You have reached the daily limit for label photos. Type the names instead, or try again tomorrow.',
        (midnight - now.getTime()) / 1000,
      );
    }

    const candidates: LabelCandidate[] = [];
    const failures: { imageIndex: number; reason: ExtractionFailureReason }[] = [];
    await Promise.all(
      cleaned.map(async (image, imageIndex) => {
        const outcome = await this.readOne(image.buffer, image.mime);
        if (typeof outcome === 'string') {
          failures.push({ imageIndex, reason: outcome });
          return;
        }
        for (const label of outcome) {
          candidates.push({
            ...label,
            imageIndex,
            needsReview: label.confidence < LOW_CONFIDENCE_THRESHOLD,
          });
        }
      }),
    );
    candidates.sort((a, b) => a.imageIndex - b.imageIndex);
    failures.sort((a, b) => a.imageIndex - b.imageIndex);

    await this.audit.record({
      actorId: userId,
      profileId,
      action: 'label_extraction.requested',
      target: { type: 'profile', id: profileId },
    });
    return {
      candidates,
      failures,
      provider: this.extractor.name,
      remainingToday: Math.max(0, this.options.dailyCap - count),
    };
  }

  private async readOne(
    image: Buffer,
    mime: LabelMimeType,
  ): Promise<ExtractedLabel[] | ExtractionFailureReason> {
    const controller = new AbortController();
    const state = { timedOut: false };
    const timer = setTimeout(() => {
      state.timedOut = true;
      controller.abort();
    }, this.options.timeoutMs);
    try {
      const labels = await Promise.race([
        this.extractor.extract(image, mime, controller.signal),
        new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('extraction timed out'));
          });
        }),
      ]);
      return labels.length === 0 ? 'unreadable' : labels;
    } catch (error) {
      if (error instanceof UnsupportedMediaTypeError) {
        throw error;
      }
      // Log that it failed and how, never the image or any text read from it.
      this.logger.warn(
        {
          provider: this.extractor.name,
          timedOut: state.timedOut,
          reason: error instanceof Error ? error.name : 'unknown',
        },
        'label extraction failed',
      );
      return state.timedOut ? 'timeout' : 'provider_error';
    } finally {
      clearTimeout(timer);
    }
  }
}
