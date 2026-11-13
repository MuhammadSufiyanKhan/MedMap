import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Problem } from '@medmap/shared';
import { PROBLEM_TYPE_BASE } from '../config/constants.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import { getRequestId } from './request-id.js';

interface BodyParserError {
  type: string;
  status: number;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    typeof error.type === 'string' &&
    'status' in error &&
    typeof error.status === 'number'
  );
}

function fromBodyParser(error: BodyParserError): AppError {
  if (error.type === 'entity.too.large') {
    return new AppError({
      status: 413,
      code: 'payload-too-large',
      title: 'Payload too large',
      detail: 'The request body is too large.',
    });
  }
  return new AppError({
    status: 400,
    code: 'malformed-json',
    title: 'Bad request',
    detail: 'The request body is not valid JSON.',
  });
}

/** Turns unmatched routes into a 404 problem document. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError('This endpoint does not exist.'));
};

/**
 * Central error handler. Every error leaves the API as RFC 7807 problem+json with the
 * request id. Unexpected errors are logged in full and answered with a generic 500, so
 * stack traces and internals never reach a client.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    const id = getRequestId(res.locals);
    let appError: AppError;
    if (error instanceof AppError) {
      appError = error;
    } else if (isBodyParserError(error) && error.status >= 400 && error.status < 500) {
      appError = fromBodyParser(error);
    } else {
      logger.error({ err: error, requestId: id, path: req.path }, 'unhandled error');
      appError = new AppError({
        status: 500,
        code: 'internal-error',
        title: 'Internal server error',
        detail: 'Something went wrong on our side. Try again in a moment.',
      });
    }

    const problem: Problem = {
      type: `${PROBLEM_TYPE_BASE}${appError.code}`,
      title: appError.title,
      status: appError.status,
      detail: appError.message,
      requestId: id,
      ...(appError.fieldErrors === undefined ? {} : { errors: appError.fieldErrors }),
    };
    for (const [name, value] of Object.entries(appError.headers)) {
      res.setHeader(name, value);
    }
    res.status(appError.status).type('application/problem+json').send(JSON.stringify(problem));
  };
}
