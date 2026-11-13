import { z } from 'zod';
import { problemSchema } from '@medmap/shared';
import { API_PREFIX } from '../config/constants.js';
import type { AnyRouteSpec } from './http.js';

type JsonObject = Record<string, unknown>;

function toSchema(schema: z.ZodType, io: 'input' | 'output'): JsonObject {
  const json: JsonObject = { ...z.toJSONSchema(schema, { io, unrepresentable: 'any' }) };
  delete json.$schema;
  return json;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parameters(schema: z.ZodType | undefined, location: 'path' | 'query'): JsonObject[] {
  if (schema === undefined) {
    return [];
  }
  const json = toSchema(schema, 'input');
  const properties = isRecord(json.properties) ? json.properties : {};
  const required = Array.isArray(json.required) ? json.required : [];
  return Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    in: location,
    required: location === 'path' || required.includes(name),
    schema: propertySchema,
  }));
}

const ERROR_DESCRIPTIONS: Record<string, string> = {
  '400': 'Malformed request',
  '401': 'Not signed in',
  '403': 'Not allowed',
  '404': 'Not found',
  '409': 'Conflict',
  '412': 'Stale write: the ETag in If-Match no longer matches',
  '413': 'Payload too large',
  '415': 'Unsupported media type',
  '422': 'Validation failed',
  '428': 'If-Match header required',
  '429': 'Too many requests',
  '500': 'Unexpected error',
};

function errorStatuses(route: AnyRouteSpec): string[] {
  const statuses = new Set(['400', '429', '500']);
  if (route.auth !== 'public') {
    statuses.add('401').add('403').add('404');
  }
  if (route.params !== undefined) {
    statuses.add('404');
  }
  if (route.body !== undefined || route.query !== undefined) {
    statuses.add('422');
  }
  if (route.method !== 'get') {
    statuses.add('409');
  }
  if (route.ifMatch === true) {
    statuses.add('412').add('428');
  }
  if (route.multipart === true) {
    statuses.add('413').add('415');
  }
  return [...statuses].sort();
}

function operationId(route: AnyRouteSpec): string {
  const words = route.path
    .split('/')
    .filter((part) => part.length > 0)
    .map((part) => part.replace(/^:/, 'by-'))
    .join('-');
  return `${route.method}-${words}`.replace(/-([a-zA-Z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
}

/**
 * Builds the OpenAPI 3.1 document from the route table. Request and response bodies are
 * the JSON Schema form of the shared zod schemas.
 */
export function buildOpenApiDocument(routes: AnyRouteSpec[], version: string): JsonObject {
  const paths: Record<string, JsonObject> = {};

  for (const route of routes) {
    const openApiPath = `${API_PREFIX}${route.path}`.replace(/:([A-Za-z]+)/g, '{$1}');
    const headerParams: JsonObject[] = [];
    if (route.ifMatch === true) {
      headerParams.push({
        name: 'If-Match',
        in: 'header',
        required: true,
        description: 'ETag of the version you are changing',
        schema: { type: 'string' },
      });
    }
    if (route.idempotent === true) {
      headerParams.push({
        name: 'Idempotency-Key',
        in: 'header',
        required: false,
        description: 'Unique key; a retried request with the same key is not applied twice',
        schema: { type: 'string', minLength: 8, maxLength: 128 },
      });
    }
    if (route.csrf === true) {
      headerParams.push({
        name: 'X-CSRF-Token',
        in: 'header',
        required: true,
        description: 'Value of the medmap_csrf cookie',
        schema: { type: 'string' },
      });
    }

    const responses: Record<string, JsonObject> = {};
    for (const [status, spec] of Object.entries(route.responses)) {
      responses[status] = {
        description: spec.description,
        ...(spec.schema === undefined
          ? {}
          : { content: { 'application/json': { schema: toSchema(spec.schema, 'output') } } }),
      };
    }
    for (const status of errorStatuses(route)) {
      responses[status] = {
        description: ERROR_DESCRIPTIONS[status] ?? 'Error',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } },
        },
      };
    }

    const operation: JsonObject = {
      operationId: operationId(route),
      summary: route.summary,
      tags: [route.tag],
      security: route.auth === 'public' ? [] : [{ bearerAuth: [] }],
      parameters: [
        ...parameters(route.params, 'path'),
        ...parameters(route.query, 'query'),
        ...headerParams,
      ],
      responses,
    };
    if (route.multipart === true) {
      operation.requestBody = {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['images'],
              properties: {
                images: {
                  type: 'array',
                  maxItems: 3,
                  items: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
      };
    } else if (route.body !== undefined) {
      operation.requestBody = {
        required: true,
        content: { 'application/json': { schema: toSchema(route.body, 'input') } },
      };
    }

    const pathItem = paths[openApiPath] ?? {};
    pathItem[route.method] = operation;
    paths[openApiPath] = pathItem;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'MedMap API',
      version,
      description:
        'REST API for MedMap. MedMap is an information tool, not medical advice. ' +
        'Errors use application/problem+json (RFC 7807).',
    },
    servers: [{ url: '/' }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: { Problem: toSchema(problemSchema, 'output') },
    },
  };
}
