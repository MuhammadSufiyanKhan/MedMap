import { BadRequestError } from './errors.js';

/** Position of the last item of a page: the sort value plus the id as a tie-breaker. */
export interface CursorPosition {
  value: string | number;
  id: string;
}

/** Encodes a keyset position as an opaque cursor string. */
export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify([position.value, position.id])).toString('base64url');
}

/**
 * Decodes a cursor produced by {@link encodeCursor}.
 * @throws BadRequestError when the cursor is malformed. Cursors are client input and are
 * validated strictly so nothing but a string or number and an id can reach a query.
 */
export function decodeCursor(cursor: string): CursorPosition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestError('The cursor is not valid.', 'invalid-cursor');
  }
  if (Array.isArray(parsed) && parsed.length === 2) {
    const items: unknown[] = parsed;
    const value = items[0];
    const id = items[1];
    if (
      (typeof value === 'string' || typeof value === 'number') &&
      typeof id === 'string' &&
      /^[a-f0-9]{24}$/.test(id)
    ) {
      return { value, id };
    }
  }
  throw new BadRequestError('The cursor is not valid.', 'invalid-cursor');
}
