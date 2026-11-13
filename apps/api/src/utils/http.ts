import type { Request, Response } from 'express';
import type { z } from 'zod';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** What a controller returns. The route wrapper turns it into the HTTP response. */
export interface HttpResult {
  status: 200 | 201 | 202 | 204;
  body?: unknown;
  /** Absolute path for the `Location` header on 201 responses. */
  location?: string;
  /** Resource version; sent as the `ETag` header. */
  version?: number;
}

export interface ResponseSpec {
  description: string;
  schema?: z.ZodType;
}

/** Validated request data handed to a controller. */
export interface RouteContext<P, Q, B> {
  params: P;
  query: Q;
  body: B;
  /** Id of the signed-in user. Empty string on public routes. */
  userId: string;
  /** Expected resource version from `If-Match`, when the route requires it. */
  expectedVersion: number;
  req: Request;
  /** Only for transport concerns such as cookies. Bodies are returned, not written. */
  res: Response;
}

export type Handler<P, Q, B> = (ctx: RouteContext<P, Q, B>) => Promise<HttpResult>;

/**
 * Declarative description of one endpoint. The same object drives request validation,
 * response serialisation and the OpenAPI document, so the three cannot drift apart.
 */
export interface RouteSpec<P = unknown, Q = unknown, B = unknown> {
  method: HttpMethod;
  /** Express-style path below the API prefix, for example `/profiles/:profileId`. */
  path: string;
  summary: string;
  tag: string;
  /** Defaults to `bearer`. */
  auth?: 'bearer' | 'public';
  params?: z.ZodType<P>;
  query?: z.ZodType<Q>;
  body?: z.ZodType<B>;
  /** Success responses by status code. Error responses are added to the docs automatically. */
  responses: Partial<Record<HttpResult['status'], ResponseSpec>>;
  /** Requires `If-Match` and passes the parsed version to the controller. */
  ifMatch?: boolean;
  /** Honours the `Idempotency-Key` header. */
  idempotent?: boolean;
  /** Accepts multipart/form-data instead of JSON. */
  multipart?: boolean;
  /** Requires the CSRF header because the route is authenticated by cookie. */
  csrf?: boolean;
  rateLimit?: 'auth' | 'extraction';
  handler: Handler<P, Q, B>;
}

/** Type-erased route used by the router and the OpenAPI generator. */
export type AnyRouteSpec = RouteSpec<never, never, never>;

/** Identity helper that infers the validated types for the handler from the zod schemas. */
export function defineRoute<P, Q, B>(spec: RouteSpec<P, Q, B>): AnyRouteSpec {
  return spec as unknown as AnyRouteSpec;
}
