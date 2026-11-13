import { z } from 'zod';

/** A MongoDB ObjectId rendered as a 24-character lowercase hex string. */
export const objectIdSchema = z
  .string()
  .regex(/^[a-f0-9]{24}$/, 'Must be a 24-character id')
  .describe('Resource id');

/** ISO 8601 timestamp in UTC. */
export const isoDateSchema = z.iso.datetime().describe('ISO 8601 timestamp');

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

/** Query parameters shared by every cursor-paginated list endpoint. */
export const cursorQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  cursor: z.string().min(1).max(512).optional(),
});
export type CursorQuery = z.infer<typeof cursorQuerySchema>;

/** Builds the response schema for a cursor-paginated list of `item`. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** One field-level validation problem inside an RFC 7807 response. */
export const fieldErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

/** RFC 7807 problem document returned for every API error. */
export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  requestId: z.string(),
  errors: z.array(fieldErrorSchema).optional(),
});
export type Problem = z.infer<typeof problemSchema>;

export const profileParamsSchema = z.strictObject({ profileId: objectIdSchema });
export type ProfileParams = z.infer<typeof profileParamsSchema>;
