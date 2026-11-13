import type { z } from 'zod';
import { ValidationError } from '../utils/errors.js';

/**
 * Validates one part of a request against its zod schema.
 * @throws ValidationError (422) with one entry per failing field.
 */
export function parseRequestPart<T>(
  schema: z.ZodType<T> | undefined,
  value: unknown,
  part: 'params' | 'query' | 'body',
): T {
  if (schema === undefined) {
    return undefined as T;
  }
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new ValidationError(
    result.error.issues.map((issue) => ({
      path: [part, ...issue.path.map(String)].join('.'),
      message: issue.message,
    })),
  );
}
