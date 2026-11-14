import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { DemoNormalizer } from '../../src/integrations/rxnorm/demo-normalizer.js';
import { CompositeNormalizer } from '../../src/integrations/rxnorm/normalizer.js';
import { RxNormNormalizer } from '../../src/integrations/rxnorm/rxnorm-client.js';
import type { FetchLike } from '../../src/integrations/rxnorm/rxnorm-client.js';
import { ServiceUnavailableError } from '../../src/utils/errors.js';

const BASE = 'https://rxnav.test/REST';
const recorded = JSON.parse(
  readFileSync(new URL('../fixtures/rxnorm/responses.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

function recordedFetch(): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const fetch: FetchLike = (url) => {
    const path = url.slice(BASE.length);
    calls.push(path);
    const body = recorded[path];
    return Promise.resolve(
      body === undefined
        ? { ok: false, status: 404, json: () => Promise.resolve({}) }
        : { ok: true, status: 200, json: () => Promise.resolve(body) },
    );
  };
  return { fetch, calls };
}

describe('RxNormNormalizer', () => {
  it('resolves an exact ingredient match to itself', async () => {
    const { fetch } = recordedFetch();
    const candidates = await new RxNormNormalizer(BASE, fetch).search('aspirin');
    expect(candidates).toEqual([
      {
        rxcui: '1191',
        name: 'aspirin',
        termType: 'IN',
        ingredients: [{ rxcui: '1191', name: 'aspirin' }],
        score: null,
      },
    ]);
  });

  it('normalises a brand name to its ingredient', async () => {
    const { fetch } = recordedFetch();
    const [candidate] = await new RxNormNormalizer(BASE, fetch).search('Tylenol');
    expect(candidate?.termType).toBe('BN');
    expect(candidate?.ingredients).toEqual([{ rxcui: '161', name: 'acetaminophen' }]);
  });

  it('expands a multi-ingredient product to every ingredient', async () => {
    const { fetch } = recordedFetch();
    const concept = await new RxNormNormalizer(BASE, fetch).resolve('1000001');
    expect(concept?.ingredients.map((i) => i.rxcui)).toEqual(['17767', '83367']);
  });

  it('falls back to approximate matching, de-duplicates and drops malformed ids', async () => {
    const { fetch, calls } = recordedFetch();
    const candidates = await new RxNormNormalizer(BASE, fetch).search('asprin');
    expect(candidates.map((c) => c.rxcui)).toEqual(['1191']);
    expect(candidates[0]?.score).toBe(9.5);
    expect(calls).toContain('/approximateTerm.json?term=asprin&maxEntries=8');
  });

  it('returns nothing for an unknown term and null for an unknown or malformed id', async () => {
    const { fetch } = recordedFetch();
    const client = new RxNormNormalizer(BASE, fetch);
    expect(await client.search('zzzznotadrug')).toEqual([]);
    expect(await client.resolve('999999')).toBeNull();
    expect(await client.resolve('1191; drop table')).toBeNull();
  });

  it('url-encodes the search term', async () => {
    const calls: string[] = [];
    const fetch: FetchLike = (url) => {
      calls.push(url);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    };
    await new RxNormNormalizer(BASE, fetch).search('a&b=c/../x');
    expect(calls[0]).toContain('name=a%26b%3Dc%2F..%2Fx');
  });

  it('maps HTTP errors, network errors and bad payloads to 503', async () => {
    const failing: FetchLike = () =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
    await expect(new RxNormNormalizer(BASE, failing).search('aspirin')).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
    const throwing: FetchLike = () => Promise.reject(new Error('socket hang up'));
    await expect(new RxNormNormalizer(BASE, throwing).resolve('1191')).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it('aborts a slow request after the timeout', async () => {
    vi.useFakeTimers();
    const hanging: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    const pending = new RxNormNormalizer(BASE, hanging, 50).resolve('1191');
    const assertion = expect(pending).rejects.toBeInstanceOf(ServiceUnavailableError);
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
    vi.useRealTimers();
  });
});

describe('DemoNormalizer', () => {
  const demo = new DemoNormalizer();

  it('finds invented names exactly and by partial match', async () => {
    expect((await demo.search('demolol'))[0]).toMatchObject({ rxcui: 'DEMO-0001', score: null });
    expect((await demo.search('Demolol 10 mg tablets')).map((c) => c.rxcui)).toContain('DEMO-0001');
    expect(await demo.search('aspirin')).toEqual([]);
  });

  it('expands the demo combination product', async () => {
    const concept = await demo.resolve('DEMO-0102');
    expect(concept?.ingredients).toEqual([
      { rxcui: 'DEMO-0002', name: 'Samplifen' },
      { rxcui: 'DEMO-0003', name: 'Testazole' },
    ]);
    expect(await demo.resolve('1191')).toBeNull();
  });
});

describe('CompositeNormalizer', () => {
  it('merges results in order without duplicates and resolves with the first hit', async () => {
    const { fetch } = recordedFetch();
    const composite = new CompositeNormalizer([
      new DemoNormalizer(),
      new RxNormNormalizer(BASE, fetch),
    ]);
    expect(composite.name).toBe('MedMap demo names + RxNorm (NLM)');
    expect((await composite.search('aspirin')).map((c) => c.rxcui)).toEqual(['1191']);
    expect((await composite.resolve('DEMO-0001'))?.name).toBe('Demolol');
    expect((await composite.resolve('1191'))?.name).toBe('aspirin');
  });

  it('keeps results from working adapters when another one is down', async () => {
    const down: FetchLike = () => Promise.reject(new Error('offline'));
    const composite = new CompositeNormalizer([
      new DemoNormalizer(),
      new RxNormNormalizer(BASE, down),
    ]);
    expect((await composite.search('Demolol')).map((c) => c.rxcui)).toEqual(['DEMO-0001']);
    expect((await composite.resolve('DEMO-0001'))?.name).toBe('Demolol');
    await expect(composite.search('aspirin')).rejects.toBeInstanceOf(ServiceUnavailableError);
    await expect(composite.resolve('1191')).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it('answers empty with no adapters', async () => {
    const none = new CompositeNormalizer([]);
    expect(none.name).toBe('none');
    expect(await none.search('aspirin')).toEqual([]);
    expect(await none.resolve('1191')).toBeNull();
  });
});
