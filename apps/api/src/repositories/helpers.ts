import { Types } from 'mongoose';
import { decodeCursor, encodeCursor } from '../utils/cursor.js';
import type { CursorPosition } from '../utils/cursor.js';

/** Converts a validated id string to an ObjectId. Ids are validated by zod at the edge. */
export function oid(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

export interface PageRequest {
  limit: number;
  cursor?: string | undefined;
}

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}

/** Keyset filter for "newest first by _id" lists. */
export function idCursorFilter(cursor: string | undefined): { _id?: { $lt: Types.ObjectId } } {
  if (cursor === undefined) {
    return {};
  }
  return { _id: { $lt: oid(decodeCursor(cursor).id) } };
}

/** Trims the one extra row fetched to detect a next page and builds the cursor. */
export function toPage<TDoc, T>(
  docs: TDoc[],
  limit: number,
  map: (doc: TDoc) => T,
  position: (doc: TDoc) => CursorPosition,
): PageResult<T> {
  const hasMore = docs.length > limit;
  const pageDocs = hasMore ? docs.slice(0, limit) : docs;
  const last = pageDocs.at(-1);
  return {
    items: pageDocs.map(map),
    nextCursor: hasMore && last !== undefined ? encodeCursor(position(last)) : null,
  };
}
