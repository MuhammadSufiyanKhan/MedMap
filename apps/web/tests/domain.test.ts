import { describe, expect, it } from 'vitest';
import { ApiError, errorMessage, fieldName } from '../src/domain/errors';
import {
  formatConfidence,
  formatDate,
  formatDateTime,
  formatMegabytes,
  KIND_LABELS,
  plural,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  summaryLine,
} from '../src/domain/format';
import {
  buildGraph,
  describeEdge,
  describeNode,
  EDGE_STYLES,
  ellipseLayout,
} from '../src/domain/graph';
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  THEME_LABELS,
  themeAttribute,
} from '../src/domain/preferences';
import { emptyCheck, id, sampleCheck } from './fixtures';

describe('buildGraph', () => {
  it('makes one node per medicine and one edge per flagged medicine pair', () => {
    const graph = buildGraph(sampleCheck());
    expect(graph.nodes.map((node) => node.label)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
      'Delta',
      'Mystery herb',
    ]);
    expect(graph.edges).toHaveLength(3);
  });

  it('merges several flags between the same two medicines, in either order, keeping the worst', () => {
    const graph = buildGraph(sampleCheck());
    const merged = graph.edges.find((edge) => edge.count === 2);
    expect(merged).toMatchObject({
      severity: 'serious',
      sourceLabel: 'Alpha',
      targetLabel: 'Beta',
    });
  });

  it('upgrades a merged edge when a later flag is more severe', () => {
    const check = sampleCheck();
    const [first, second] = check.flaggedPairs;
    if (!first || !second) {
      throw new Error('fixture changed');
    }
    const graph = buildGraph({ ...check, flaggedPairs: [{ ...first, severity: 'minor' }, second] });
    expect(graph.edges[0]).toMatchObject({ severity: 'serious', count: 2 });
  });

  it('orders edges by severity', () => {
    expect(buildGraph(sampleCheck()).edges.map((edge) => edge.severity)).toEqual([
      'serious',
      'moderate',
      'minor',
    ]);
  });

  it('never creates an edge for an unflagged pair', () => {
    const graph = buildGraph(emptyCheck());
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toEqual([]);
    expect(graph.nodes.every((node) => node.worst === null && node.flagCount === 0)).toBe(true);
  });

  it('keeps unchecked medicines as nodes marked unchecked', () => {
    const herb = buildGraph(sampleCheck()).nodes.find((node) => node.label === 'Mystery herb');
    expect(herb).toMatchObject({ checked: false, worst: null });
  });

  it('records the worst severity and flag count per node', () => {
    const nodes = buildGraph(sampleCheck()).nodes;
    expect(nodes.find((node) => node.label === 'Alpha')).toMatchObject({
      worst: 'serious',
      flagCount: 3,
    });
    expect(nodes.find((node) => node.label === 'Delta')).toMatchObject({
      worst: 'minor',
      flagCount: 1,
    });
  });

  it('focus mode keeps the medicine, its flagged neighbours and their edges only', () => {
    const graph = buildGraph(sampleCheck(), { focusId: id(3) });
    expect(graph.nodes.map((node) => node.label).sort()).toEqual(['Alpha', 'Delta', 'Gamma']);
    expect(graph.edges).toHaveLength(2);
  });

  it('focus on a medicine with no flags shows it alone; an unknown focus id is ignored', () => {
    expect(buildGraph(sampleCheck(), { focusId: id(5) }).nodes.map((node) => node.label)).toEqual([
      'Mystery herb',
    ]);
    expect(buildGraph(sampleCheck(), { focusId: id(77) }).nodes).toHaveLength(5);
  });

  it('places nodes inside the layout box at distinct points', () => {
    const graph = buildGraph(sampleCheck(), { width: 400, height: 300 });
    const points = new Set(graph.nodes.map((node) => `${String(node.x)},${String(node.y)}`));
    expect(points.size).toBe(5);
    for (const node of graph.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(400);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(300);
    }
  });

  it('handles an empty check', () => {
    expect(buildGraph({ ...emptyCheck(), medications: [] })).toEqual({ nodes: [], edges: [] });
  });
});

describe('ellipseLayout', () => {
  it('centres a single point and starts at the top otherwise', () => {
    expect(ellipseLayout(1, 100, 100)).toEqual([{ x: 50, y: 50 }]);
    expect(ellipseLayout(4, 100, 100)[0]).toEqual({ x: 50, y: 12 });
    expect(ellipseLayout(0, 100, 100)).toEqual([]);
  });
});

describe('graph descriptions and styles', () => {
  it('encodes severity with distinct line widths and patterns, not colour', () => {
    const widths = Object.values(EDGE_STYLES).map((style) => style.width);
    expect(new Set(widths).size).toBe(3);
    expect(EDGE_STYLES.serious.dash).toBeNull();
    expect(EDGE_STYLES.moderate.dash).not.toBe(EDGE_STYLES.minor.dash);
  });

  it('describes edges and nodes for screen readers without calling anything safe', () => {
    const graph = buildGraph(sampleCheck());
    const texts = [...graph.edges.map(describeEdge), ...graph.nodes.map(describeNode)];
    expect(texts[0]).toBe('serious interaction between Alpha and Beta, 2 flagged ingredient pairs');
    expect(texts).toContain('Mystery herb: could not check');
    expect(texts).toContain('Delta: 1 flag, most severe minor');
    const [alpha] = graph.nodes;
    expect(alpha && describeNode({ ...alpha, flagCount: 0, worst: null })).toBe(
      'Alpha: no flags in this source',
    );
    expect(texts.join(' ')).not.toMatch(/\bsafe\b/i);
  });
});

describe('format', () => {
  it('pluralises', () => {
    expect(plural(1, 'medicine')).toBe('1 medicine');
    expect(plural(0, 'medicine')).toBe('0 medicines');
    expect(plural(2, 'person', 'people')).toBe('2 people');
  });

  it('always lists all three severities', () => {
    expect(summaryLine({ serious: 0, moderate: 2, minor: 0 })).toBe(
      '0 serious, 2 moderate, 0 minor',
    );
  });

  it('formats dates and tolerates bad input', () => {
    expect(formatDate('2026-11-14T09:30:00.000Z', 'en-GB')).toBe('14 November 2026');
    expect(formatDateTime('2026-11-14T09:30:00.000Z', 'en-GB')).toContain('14 November 2026');
    expect(formatDate('nonsense')).toBe('');
    expect(formatDateTime('nonsense')).toBe('');
  });

  it('formats confidence and sizes', () => {
    expect(formatConfidence(0.876)).toBe('88%');
    expect(formatConfidence(7)).toBe('100%');
    expect(formatConfidence(-1)).toBe('0%');
    expect(formatMegabytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('has a label for every kind and role', () => {
    expect(Object.values(KIND_LABELS).every((label) => label.length > 0)).toBe(true);
    expect(Object.keys(ROLE_LABELS)).toEqual(Object.keys(ROLE_DESCRIPTIONS));
  });
});

describe('errors', () => {
  it('explains offline, stale writes and rate limits in plain words', () => {
    expect(errorMessage(new ApiError({ status: 0, code: 'offline', message: 'x' }))).toContain(
      'offline',
    );
    expect(
      errorMessage(new ApiError({ status: 412, code: 'precondition-failed', message: 'x' })),
    ).toContain('Reload');
    expect(
      errorMessage(
        new ApiError({
          status: 429,
          code: 'too-many-requests',
          message: 'Slow down.',
          retryAfterSeconds: 90,
        }),
      ),
    ).toBe('Slow down. Try again in about 2 minutes.');
    expect(
      errorMessage(
        new ApiError({
          status: 429,
          code: 'too-many-requests',
          message: 'Slow down.',
          retryAfterSeconds: 10,
        }),
      ),
    ).toContain('1 minute.');
    expect(errorMessage(new ApiError({ status: 429, code: 'x', message: 'Slow down.' }))).toBe(
      'Slow down.',
    );
    expect(
      errorMessage(new ApiError({ status: 409, code: 'conflict', message: 'Already there.' })),
    ).toBe('Already there.');
    expect(errorMessage(new Error('internal detail'))).toBe('Something went wrong. Try again.');
  });

  it('exposes error details', () => {
    const error = new ApiError({
      status: 422,
      code: 'validation-failed',
      message: 'm',
      fieldErrors: [{ path: 'body.email', message: 'bad' }],
      requestId: 'r1',
    });
    expect(error.isOffline).toBe(false);
    expect(error.requestId).toBe('r1');
    expect(fieldName('body.email')).toBe('email');
    expect(fieldName('email')).toBe('email');
  });
});

describe('preferences', () => {
  it('falls back to defaults for missing or malformed storage', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{not json')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('"a string"')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{"theme":"neon","textSize":"huge","noticeAccepted":"yes"}')).toEqual(
      DEFAULT_PREFERENCES,
    );
  });

  it('reads valid values', () => {
    expect(
      parsePreferences(
        '{"theme":"dark","textSize":"large","noticeAccepted":true,"extractionConsent":true}',
      ),
    ).toEqual({
      theme: 'dark',
      textSize: 'large',
      noticeAccepted: true,
      extractionConsent: true,
    });
  });

  it('maps themes to the data attribute', () => {
    expect(themeAttribute('system')).toBeNull();
    expect(themeAttribute('contrast')).toBe('contrast');
    expect(Object.keys(THEME_LABELS)).toHaveLength(4);
  });
});
