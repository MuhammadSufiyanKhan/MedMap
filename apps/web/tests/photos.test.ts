import { describe, expect, it } from 'vitest';
import { FAILURE_TEXT, validatePhotos } from '../src/domain/photos';

const photo = (overrides: Partial<{ name: string; size: number; type: string }> = {}) => ({
  name: 'label.jpg',
  size: 1024,
  type: 'image/jpeg',
  ...overrides,
});

describe('validatePhotos', () => {
  it('accepts one to three allowed photos', () => {
    expect(validatePhotos([photo()])).toBeNull();
    expect(
      validatePhotos([photo(), photo({ type: 'image/png' }), photo({ type: 'image/webp' })]),
    ).toBeNull();
    // Some browsers report no type; the server decides from the bytes.
    expect(validatePhotos([photo({ type: '' })])).toBeNull();
  });

  it('explains what is wrong with a selection', () => {
    expect(validatePhotos([])).toBe('Choose at least one photo.');
    expect(validatePhotos([photo(), photo(), photo(), photo()])).toBe(
      'Choose up to 3 photos at a time.',
    );
    expect(validatePhotos([photo({ name: 'big.jpg', size: 6 * 1024 * 1024 })])).toBe(
      'big.jpg is 6.0 MB. Each photo can be up to 5.0 MB.',
    );
    expect(validatePhotos([photo({ name: 'scan.pdf', type: 'application/pdf' })])).toBe(
      'scan.pdf is not a JPEG, PNG or WebP photo.',
    );
  });

  it('has a message for every failure reason, none of which reassures', () => {
    expect(Object.keys(FAILURE_TEXT).sort()).toEqual(['provider_error', 'timeout', 'unreadable']);
    expect(Object.values(FAILURE_TEXT).join(' ')).not.toMatch(/\bsafe\b/i);
  });
});
