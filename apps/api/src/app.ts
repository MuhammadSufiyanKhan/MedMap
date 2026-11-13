import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import type { Express, RequestHandler } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { API_PREFIX, JSON_BODY_LIMIT } from './config/constants.js';
import type { AppConfig } from './config/env.js';
import { healthz, readyz } from './controllers/health.controller.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { createRateLimiters } from './middleware/rate-limit.js';
import { getRequestId, requestId } from './middleware/request-id.js';
import { buildRouter } from './routes/build-router.js';
import type { IdempotencyGate } from './routes/build-router.js';
import type { AnyRouteSpec } from './utils/http.js';
import type { Logger } from './utils/logger.js';
import { buildOpenApiDocument } from './utils/openapi.js';

export interface AppDeps {
  config: AppConfig;
  logger: Logger;
  routes: AnyRouteSpec[];
  verifyAccessToken: (token: string) => string;
  idempotency: IdempotencyGate;
  multipart: RequestHandler;
  pingDatabase: () => Promise<boolean>;
  version: string;
}

/**
 * Builds the Express application. It has no side effects: nothing listens and nothing
 * connects here, so tests can build as many apps as they like.
 */
export function buildApp(deps: AppDeps): Express {
  const { config, logger } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('query parser', 'simple');
  app.set('etag', false);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => getRequestId(res.locals),
      customProps: (_req, res) => ({ requestId: getRequestId(res.locals) }),
      serializers: {
        req: (req: { method: string; url: string }) => ({
          method: req.method,
          // Query strings can hold search terms such as medicine names; log the path only.
          path: req.url.split('?')[0],
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
    }),
  );

  app.get('/healthz', healthz);
  app.get('/readyz', readyz(deps.pingDatabase));

  const openApiDocument = buildOpenApiDocument(deps.routes, deps.version);
  if (config.apiDocsEnabled) {
    // Swagger UI needs inline scripts and styles, so it gets its own relaxed policy.
    // It is off in production unless API_DOCS_ENABLED=true.
    app.get('/api/docs/openapi.json', (_req, res) => {
      res.json(openApiDocument);
    });
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      strictTransportSecurity: config.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true }
        : false,
    }),
  );
  app.use(
    cors({
      origin: config.webOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'If-Match',
        'Idempotency-Key',
        'X-CSRF-Token',
        'X-Request-Id',
      ],
      exposedHeaders: ['ETag', 'Location', 'Retry-After', 'X-Request-Id', 'RateLimit'],
      maxAge: 600,
    }),
  );

  const limiters = createRateLimiters(config.rateLimit);
  const api = express.Router();
  api.use(limiters.general);
  api.use((_req, res, next) => {
    // Everything under the API is account or health data: never cache it anywhere.
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use(express.json({ limit: JSON_BODY_LIMIT, type: 'application/json' }));
  api.use(cookieParser());
  api.use(
    buildRouter(deps.routes, {
      verifyAccessToken: deps.verifyAccessToken,
      idempotency: deps.idempotency,
      limiters,
      allowedOrigins: config.webOrigins,
      multipart: deps.multipart,
    }),
  );
  app.use(API_PREFIX, api);

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
