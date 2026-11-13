import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Gives every request an id, reusing a well-formed `X-Request-Id` from the proxy.
 * The id appears on every log line and in every error body.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get('x-request-id');
  const id = incoming !== undefined && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};

/** Reads the request id set by {@link requestId}. */
export function getRequestId(locals: Record<string, unknown>): string {
  return typeof locals.requestId === 'string' ? locals.requestId : 'unknown';
}
