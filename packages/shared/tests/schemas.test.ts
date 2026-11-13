import { describe, expect, it } from 'vitest';
import {
  createMedicationRequestSchema,
  createProfileRequestSchema,
  cursorQuerySchema,
  extractedLabelSchema,
  loginRequestSchema,
  MAX_PAGE_SIZE,
  medicationListQuerySchema,
  normalizeQuerySchema,
  objectIdSchema,
  pageSchema,
  registerRequestSchema,
  replaceMemberRequestSchema,
  rxcuiSchema,
  updateMedicationRequestSchema,
  updateProfileRequestSchema,
} from '../src/index.js';

describe('auth schemas', () => {
  it('normalises the email and enforces password length', () => {
    const parsed = registerRequestSchema.parse({
      email: '  Carer@Example.COM ',
      password: 'long-enough-pass',
    });
    expect(parsed.email).toBe('carer@example.com');
    expect(registerRequestSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(
      false,
    );
  });

  it('rejects operator objects and unknown keys', () => {
    expect(loginRequestSchema.safeParse({ email: { $gt: '' }, password: 'x' }).success).toBe(false);
    expect(
      loginRequestSchema.safeParse({ email: 'a@b.co', password: 'x', isAdmin: true }).success,
    ).toBe(false);
  });
});

describe('common schemas', () => {
  it('accepts only 24-hex ids', () => {
    expect(objectIdSchema.safeParse('a'.repeat(24)).success).toBe(true);
    expect(objectIdSchema.safeParse('A'.repeat(24)).success).toBe(false);
    expect(objectIdSchema.safeParse('abc').success).toBe(false);
  });

  it('coerces and caps the page size', () => {
    expect(cursorQuerySchema.parse({}).limit).toBe(25);
    expect(cursorQuerySchema.parse({ limit: '10' }).limit).toBe(10);
    expect(cursorQuerySchema.safeParse({ limit: String(MAX_PAGE_SIZE + 1) }).success).toBe(false);
    expect(cursorQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('builds page schemas', () => {
    const schema = pageSchema(objectIdSchema);
    expect(schema.parse({ items: ['b'.repeat(24)], nextCursor: null }).items).toHaveLength(1);
  });
});

describe('profile schemas', () => {
  it('trims names and bounds the birth year', () => {
    expect(createProfileRequestSchema.parse({ displayName: '  Mum ' }).displayName).toBe('Mum');
    expect(createProfileRequestSchema.safeParse({ displayName: ' ' }).success).toBe(false);
    expect(
      createProfileRequestSchema.safeParse({ displayName: 'Mum', birthYear: 1800 }).success,
    ).toBe(false);
  });

  it('requires at least one field on update', () => {
    expect(updateProfileRequestSchema.safeParse({}).success).toBe(false);
    expect(updateProfileRequestSchema.safeParse({ notes: null }).success).toBe(true);
  });

  it('never lets a member be made owner', () => {
    expect(replaceMemberRequestSchema.safeParse({ role: 'owner' }).success).toBe(false);
    expect(replaceMemberRequestSchema.safeParse({ role: 'viewer' }).success).toBe(true);
  });
});

describe('medication schemas', () => {
  it('applies defaults and rejects client-supplied ingredients', () => {
    const parsed = createMedicationRequestSchema.parse({ displayName: 'Demolol 10 mg' });
    expect(parsed.kind).toBe('unknown');
    expect(parsed.source).toBe('manual');
    expect(
      createMedicationRequestSchema.safeParse({ displayName: 'x', ingredientRxcuis: ['1'] })
        .success,
    ).toBe(false);
  });

  it('accepts RxNorm and demo concept ids only', () => {
    expect(rxcuiSchema.safeParse('1191').success).toBe(true);
    expect(rxcuiSchema.safeParse('DEMO-0001').success).toBe(true);
    expect(rxcuiSchema.safeParse('1191; drop').success).toBe(false);
    expect(rxcuiSchema.safeParse('').success).toBe(false);
  });

  it('whitelists sort and status', () => {
    expect(medicationListQuerySchema.parse({}).sort).toBe('-createdAt');
    expect(medicationListQuerySchema.safeParse({ sort: 'passwordHash' }).success).toBe(false);
    expect(medicationListQuerySchema.safeParse({ status: 'deleted' }).success).toBe(false);
  });

  it('requires at least one field on update', () => {
    expect(updateMedicationRequestSchema.safeParse({}).success).toBe(false);
    expect(updateMedicationRequestSchema.safeParse({ status: 'stopped' }).success).toBe(true);
  });

  it('bounds the normalise term', () => {
    expect(normalizeQuerySchema.safeParse({ term: 'a' }).success).toBe(false);
    expect(normalizeQuerySchema.parse({ term: ' aspirin ' }).term).toBe('aspirin');
  });
});

describe('extraction schema', () => {
  it('accepts a well-formed reading', () => {
    const label = {
      name: 'Demolol',
      strengthText: '10 mg',
      form: 'tablet',
      rawText: 'DEMOLOL 10 MG TABLETS',
      confidence: 0.92,
    };
    expect(extractedLabelSchema.parse(label)).toEqual(label);
  });

  it('rejects out-of-range confidence and empty names', () => {
    const base = { name: 'x', strengthText: null, form: null, rawText: '', confidence: 0.5 };
    expect(extractedLabelSchema.safeParse({ ...base, confidence: 1.2 }).success).toBe(false);
    expect(extractedLabelSchema.safeParse({ ...base, name: '  ' }).success).toBe(false);
  });
});
