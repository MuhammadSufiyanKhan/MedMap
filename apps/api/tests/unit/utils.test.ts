import { describe, expect, it } from 'vitest';
import { safeEqual, sha256, randomToken } from '../../src/utils/crypto.js';
import { decodeCursor, encodeCursor } from '../../src/utils/cursor.js';
import { BadRequestError, PreconditionRequiredError } from '../../src/utils/errors.js';
import { formatEtag, parseIfMatch } from '../../src/utils/etag.js';

describe('cursor', () => {
  it('round-trips a position', () => {
    const position = { value: 'Aspirin', id: 'a'.repeat(24) };
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it.each([
    'not-base64-json',
    Buffer.from('{"$gt":""}').toString('base64url'),
    Buffer.from('[{"$gt":""},"aaaaaaaaaaaaaaaaaaaaaaaa"]').toString('base64url'),
    Buffer.from('["x","short"]').toString('base64url'),
  ])('rejects a malformed or hostile cursor: %s', (cursor) => {
    expect(() => decodeCursor(cursor)).toThrow(BadRequestError);
  });
});

describe('etag', () => {
  it('formats and parses versions', () => {
    expect(formatEtag(3)).toBe('"v3"');
    expect(parseIfMatch('"v3"')).toBe(3);
  });

  it('requires the header', () => {
    expect(() => parseIfMatch(undefined)).toThrow(PreconditionRequiredError);
    expect(() => parseIfMatch('  ')).toThrow(PreconditionRequiredError);
  });

  it('rejects foreign etags', () => {
    expect(() => parseIfMatch('W/"abc"')).toThrow(BadRequestError);
    expect(() => parseIfMatch('*')).toThrow(BadRequestError);
  });
});

describe('crypto helpers', () => {
  it('creates distinct url-safe tokens', () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(a).not.toBe(randomToken());
  });

  it('compares in constant time regardless of length', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(sha256('a')).toHaveLength(64);
  });
});
