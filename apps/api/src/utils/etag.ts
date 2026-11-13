import { BadRequestError, PreconditionRequiredError } from './errors.js';

/** Builds the strong ETag for a resource version. */
export function formatEtag(version: number): string {
  return `"v${String(version)}"`;
}

/**
 * Parses an `If-Match` header into the expected version number.
 * @throws PreconditionRequiredError when the header is missing.
 * @throws BadRequestError when it is not an ETag issued by this API.
 */
export function parseIfMatch(header: string | undefined): number {
  if (header === undefined || header.trim() === '') {
    throw new PreconditionRequiredError();
  }
  const match = /^"v(\d{1,9})"$/.exec(header.trim());
  if (!match?.[1]) {
    throw new BadRequestError('The If-Match header is not a valid ETag.', 'invalid-etag');
  }
  return Number(match[1]);
}
