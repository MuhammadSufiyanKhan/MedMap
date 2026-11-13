import { describe, expect, it } from 'vitest';
import { MOTION, MOTION_QUERIES } from '../src/domain/motion';

describe('motion constants', () => {
  it('keeps durations short enough not to delay reading', () => {
    for (const duration of Object.values(MOTION.duration)) {
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThanOrEqual(1);
    }
  });

  it('defines both motion media queries', () => {
    expect(MOTION_QUERIES.reduced).toContain('reduce');
    expect(MOTION_QUERIES.allowed).toContain('no-preference');
  });
});
