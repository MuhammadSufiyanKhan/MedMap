import { describe, expect, it } from 'vitest';
import { compareSeverity, severityRank, summarise, worstSeverity } from '../src/domain/severity';

describe('severity ordering', () => {
  it('ranks serious before moderate before minor', () => {
    expect(severityRank('serious')).toBeLessThan(severityRank('moderate'));
    expect(severityRank('moderate')).toBeLessThan(severityRank('minor'));
  });

  it('sorts the most severe first', () => {
    expect((['minor', 'serious', 'moderate'] as const).toSorted(compareSeverity)).toEqual([
      'serious',
      'moderate',
      'minor',
    ]);
  });

  it('finds the worst severity', () => {
    expect(worstSeverity([])).toBeNull();
    expect(worstSeverity(['minor', 'moderate'])).toBe('moderate');
    expect(worstSeverity(['minor', 'serious', 'moderate'])).toBe('serious');
  });

  it('counts by severity', () => {
    expect(summarise(['minor', 'serious', 'minor'])).toEqual({ serious: 1, moderate: 0, minor: 2 });
  });
});
