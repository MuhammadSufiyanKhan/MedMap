import { IDEMPOTENCY_TTL_HOURS } from '../config/constants.js';
import type { IdempotencyRepository } from '../repositories/idempotency.repository.js';
import { addMinutes } from '../utils/clock.js';
import type { Clock } from '../utils/clock.js';
import { ConflictError } from '../utils/errors.js';
import type { HttpResult } from '../utils/http.js';

function isSuccessStatus(status: number): status is HttpResult['status'] {
  return status === 200 || status === 201 || status === 202 || status === 204;
}

/**
 * Makes resource-creating POSTs safe to retry. The first request with a key runs and its
 * response is stored for 24 hours; a retry with the same key and body gets that response
 * back without running again.
 */
export class IdempotencyService {
  public constructor(
    private readonly records: IdempotencyRepository,
    private readonly clock: Clock,
  ) {}

  /**
   * @returns the stored response when this is a replay, or null when the caller should run
   * the request now.
   * @throws ConflictError when the key was used for a different request, or the first
   * request with this key is still running.
   */
  public async begin(userId: string, key: string, requestHash: string): Promise<HttpResult | null> {
    const reserved = await this.records.reserve({
      userId,
      key,
      requestHash,
      expiresAt: addMinutes(this.clock(), IDEMPOTENCY_TTL_HOURS * 60),
    });
    if (reserved) {
      return null;
    }
    const existing = await this.records.find(userId, key);
    if (existing === null) {
      return null;
    }
    if (existing.requestHash !== requestHash) {
      throw new ConflictError(
        'This Idempotency-Key was already used for a different request.',
        'idempotency-key-reused',
      );
    }
    if (existing.response === null || !isSuccessStatus(existing.response.status)) {
      throw new ConflictError(
        'The first request with this Idempotency-Key is still being processed.',
        'idempotency-in-progress',
      );
    }
    const result: HttpResult = { status: existing.response.status, body: existing.response.body };
    if (existing.response.location !== null) {
      result.location = existing.response.location;
    }
    if (existing.response.etag !== null) {
      result.version = Number(existing.response.etag);
    }
    return result;
  }

  public async complete(userId: string, key: string, result: HttpResult): Promise<void> {
    await this.records.saveResponse(userId, key, {
      status: result.status,
      body: result.body ?? null,
      location: result.location ?? null,
      etag: result.version === undefined ? null : String(result.version),
    });
  }

  /** Frees the key after a failed request so the client can retry it. */
  public async abandon(userId: string, key: string): Promise<void> {
    await this.records.release(userId, key);
  }
}
