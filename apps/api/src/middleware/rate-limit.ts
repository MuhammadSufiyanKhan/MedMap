import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { TooManyRequestsError } from '../utils/errors.js';

export interface RateLimiters {
  general: RequestHandler;
  auth: RequestHandler;
  extraction: RequestHandler;
}

function limiter(options: { windowMs: number; limit: number; message: string }): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new TooManyRequestsError(options.message, options.windowMs / 1000));
    },
  });
}

/**
 * Builds the rate limiters. They use the in-memory store, which is correct for a single
 * API instance (see docs/DECISIONS.md, ADR-0009, for the multi-instance upgrade path).
 * Limits are per client IP; the label-extraction daily cap is enforced per user in the
 * service layer on top of this.
 */
export function createRateLimiters(limits: {
  generalMax: number;
  authMax: number;
  extractionMax: number;
}): RateLimiters {
  return {
    general: limiter({
      windowMs: 15 * 60 * 1000,
      limit: limits.generalMax,
      message: 'Too many requests. Wait a few minutes and try again.',
    }),
    auth: limiter({
      windowMs: 15 * 60 * 1000,
      limit: limits.authMax,
      message: 'Too many sign-in attempts. Wait a few minutes and try again.',
    }),
    extraction: limiter({
      windowMs: 60 * 60 * 1000,
      limit: limits.extractionMax,
      message: 'Too many photos in a short time. Try again later or type the names.',
    }),
  };
}
