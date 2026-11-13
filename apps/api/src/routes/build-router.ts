import { createHash } from 'node:crypto';
import { Router } from 'express';
import type { Request, RequestHandler, Response } from 'express';
import { assertCsrf } from '../middleware/csrf.js';
import { authenticate } from '../middleware/auth.js';
import type { AccessTokenVerifier } from '../middleware/auth.js';
import type { RateLimiters } from '../middleware/rate-limit.js';
import { parseRequestPart } from '../middleware/validate.js';
import { BadRequestError, UnauthorizedError, UnsupportedMediaTypeError } from '../utils/errors.js';
import { formatEtag, parseIfMatch } from '../utils/etag.js';
import type { AnyRouteSpec, HttpResult } from '../utils/http.js';

/** Stores and replays responses for requests that carry an `Idempotency-Key`. */
export interface IdempotencyGate {
  begin(userId: string, key: string, requestHash: string): Promise<HttpResult | null>;
  complete(userId: string, key: string, result: HttpResult): Promise<void>;
  abandon(userId: string, key: string): Promise<void>;
}

export interface RouterDeps {
  verifyAccessToken: AccessTokenVerifier;
  idempotency: IdempotencyGate;
  limiters: RateLimiters;
  allowedOrigins: string[];
  /** Multer-based parser for the one multipart endpoint. */
  multipart: RequestHandler;
}

const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;

function readUserId(res: Response): string {
  const userId: unknown = res.locals.userId;
  if (typeof userId !== 'string' || userId === '') {
    throw new UnauthorizedError();
  }
  return userId;
}

function assertJsonRequest(req: Request, route: AnyRouteSpec): void {
  if (route.body === undefined) {
    return;
  }
  if (!req.is('application/json')) {
    throw new UnsupportedMediaTypeError('Send the request body as application/json.');
  }
}

function send(res: Response, route: AnyRouteSpec, result: HttpResult): void {
  if (result.location !== undefined) {
    res.setHeader('Location', result.location);
  }
  if (result.version !== undefined) {
    res.setHeader('ETag', formatEtag(result.version));
  }
  if (result.status === 204 || result.body === undefined) {
    res.status(result.status).end();
    return;
  }
  // Serialising through the documented schema guarantees real responses match the
  // OpenAPI document and strips any field that is not part of the public contract.
  const schema = route.responses[result.status]?.schema;
  const body: unknown = schema === undefined ? result.body : schema.parse(result.body);
  res.status(result.status).json(body);
}

function hashRequest(req: Request): string {
  return createHash('sha256')
    .update(`${req.method} ${req.originalUrl}\n${JSON.stringify(req.body ?? null)}`)
    .digest('hex');
}

function toHandler(route: AnyRouteSpec, deps: RouterDeps): RequestHandler {
  return async (req, res) => {
    if (route.csrf === true) {
      assertCsrf(req, deps.allowedOrigins);
    }
    const userId = route.auth === 'public' ? '' : readUserId(res);
    if (route.multipart !== true) {
      assertJsonRequest(req, route);
    }
    const expectedVersion = route.ifMatch === true ? parseIfMatch(req.get('if-match')) : 0;
    const ctx = {
      params: parseRequestPart(route.params, req.params, 'params'),
      query: parseRequestPart(route.query, req.query, 'query'),
      body: parseRequestPart(route.body, req.body, 'body'),
      userId,
      expectedVersion,
      req,
      res,
    };

    const key = route.idempotent === true ? req.get('idempotency-key') : undefined;
    if (key === undefined) {
      send(res, route, await route.handler(ctx));
      return;
    }
    if (!IDEMPOTENCY_KEY.test(key)) {
      throw new BadRequestError(
        'The Idempotency-Key header must be 8 to 128 letters, digits or . _ : -',
        'invalid-idempotency-key',
      );
    }
    const replay = await deps.idempotency.begin(userId, key, hashRequest(req));
    if (replay !== null) {
      res.setHeader('Idempotent-Replayed', 'true');
      send(res, route, replay);
      return;
    }
    let result: HttpResult;
    try {
      result = await route.handler(ctx);
    } catch (error) {
      await deps.idempotency.abandon(userId, key);
      throw error;
    }
    await deps.idempotency.complete(userId, key, result);
    send(res, route, result);
  };
}

/** Builds an Express router from the declarative route table. */
export function buildRouter(routes: AnyRouteSpec[], deps: RouterDeps): Router {
  const router = Router();
  for (const route of routes) {
    const chain: RequestHandler[] = [];
    if (route.rateLimit !== undefined) {
      chain.push(deps.limiters[route.rateLimit]);
    }
    if (route.auth !== 'public') {
      // Authenticate before any body parsing so anonymous clients cannot upload files.
      chain.push((req, res, next) => {
        res.locals.userId = authenticate(req, deps.verifyAccessToken);
        next();
      });
    }
    if (route.multipart === true) {
      chain.push(deps.multipart);
    }
    chain.push(toHandler(route, deps));
    router[route.method](route.path, ...chain);
  }
  return router;
}
