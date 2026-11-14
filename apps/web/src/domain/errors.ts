import type { FieldError } from '@medmap/shared';

/** An error from the API (or from the network) in a shape the UI can show. */
export class ApiError extends Error {
  public readonly status: number;
  /** Stable slug from the problem `type`, for example `email-taken`. */
  public readonly code: string;
  public readonly fieldErrors: FieldError[];
  public readonly requestId: string | null;
  public readonly retryAfterSeconds: number | null;

  public constructor(options: {
    status: number;
    code: string;
    message: string;
    fieldErrors?: FieldError[];
    requestId?: string | null;
    retryAfterSeconds?: number | null;
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors ?? [];
    this.requestId = options.requestId ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }

  /** True when the request never reached the server. */
  public get isOffline(): boolean {
    return this.status === 0;
  }
}

/** Plain-language message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isOffline) {
      return 'You seem to be offline. Check your connection and try again.';
    }
    if (error.status === 412) {
      return 'Someone else changed this just now. Reload to see the latest version, then try again.';
    }
    if (error.status === 429 && error.retryAfterSeconds !== null) {
      const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
      return `${error.message} Try again in about ${String(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}.`;
    }
    return error.message;
  }
  return 'Something went wrong. Try again.';
}

/** The last segment of a field-error path: `body.email` becomes `email`. */
export function fieldName(path: string): string {
  return path.split('.').slice(1).join('.') || path;
}
