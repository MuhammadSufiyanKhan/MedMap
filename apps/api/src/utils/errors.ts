import type { FieldError } from '@medmap/shared';

/**
 * Base class for every error the API returns on purpose. The error middleware turns these
 * into RFC 7807 problem documents. Anything that is not an `AppError` becomes a generic 500.
 */
export class AppError extends Error {
  public readonly status: number;
  /** Short slug used to build the problem `type` URI. */
  public readonly code: string;
  public readonly title: string;
  public readonly fieldErrors: FieldError[] | undefined;
  public readonly headers: Record<string, string>;

  public constructor(options: {
    status: number;
    code: string;
    title: string;
    detail: string;
    fieldErrors?: FieldError[];
    headers?: Record<string, string>;
    cause?: unknown;
  }) {
    super(options.detail, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.status = options.status;
    this.code = options.code;
    this.title = options.title;
    this.fieldErrors = options.fieldErrors;
    this.headers = options.headers ?? {};
  }

  /** Attaches the underlying error for server logs. It is never sent to the client. */
  public withCause(cause: unknown): this {
    this.cause = cause;
    return this;
  }
}

export class BadRequestError extends AppError {
  public constructor(detail: string, code = 'bad-request') {
    super({ status: 400, code, title: 'Bad request', detail });
  }
}

export class UnauthorizedError extends AppError {
  public constructor(detail = 'Sign in to continue.', code = 'unauthorized') {
    super({
      status: 401,
      code,
      title: 'Unauthorized',
      detail,
      headers: { 'WWW-Authenticate': 'Bearer' },
    });
  }
}

export class ForbiddenError extends AppError {
  public constructor(detail = 'You do not have permission to do this.', code = 'forbidden') {
    super({ status: 403, code, title: 'Forbidden', detail });
  }
}

export class NotFoundError extends AppError {
  public constructor(detail = 'The resource was not found.') {
    super({ status: 404, code: 'not-found', title: 'Not found', detail });
  }
}

export class ConflictError extends AppError {
  public constructor(detail: string, code = 'conflict') {
    super({ status: 409, code, title: 'Conflict', detail });
  }
}

export class PreconditionFailedError extends AppError {
  public constructor(detail = 'The resource changed since you loaded it. Reload and try again.') {
    super({ status: 412, code: 'precondition-failed', title: 'Precondition failed', detail });
  }
}

export class PreconditionRequiredError extends AppError {
  public constructor(detail = 'Send an If-Match header with the ETag of the resource.') {
    super({
      status: 428,
      code: 'precondition-required',
      title: 'Precondition required',
      detail,
    });
  }
}

export class PayloadTooLargeError extends AppError {
  public constructor(detail: string) {
    super({ status: 413, code: 'payload-too-large', title: 'Payload too large', detail });
  }
}

export class UnsupportedMediaTypeError extends AppError {
  public constructor(detail: string) {
    super({
      status: 415,
      code: 'unsupported-media-type',
      title: 'Unsupported media type',
      detail,
    });
  }
}

export class ValidationError extends AppError {
  public constructor(fieldErrors: FieldError[], detail = 'Some fields are not valid.') {
    super({
      status: 422,
      code: 'validation-failed',
      title: 'Validation failed',
      detail,
      fieldErrors,
    });
  }
}

export class TooManyRequestsError extends AppError {
  public constructor(detail: string, retryAfterSeconds: number) {
    super({
      status: 429,
      code: 'too-many-requests',
      title: 'Too many requests',
      detail,
      headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))) },
    });
  }
}

export class ServiceUnavailableError extends AppError {
  public constructor(detail: string, code = 'service-unavailable') {
    super({ status: 503, code, title: 'Service unavailable', detail });
  }
}
