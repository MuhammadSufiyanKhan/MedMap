import { z } from 'zod';
import type { DrugCandidate, Ingredient } from '@medmap/shared';
import { ServiceUnavailableError } from '../../utils/errors.js';
import type { DrugNormalizer, ResolvedConcept } from './normalizer.js';

/** Minimal fetch signature, so tests can inject a recorded-fixture fetch. */
export type FetchLike = (
  url: string,
  init: { signal: AbortSignal; headers: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

// RxNav response shapes, validated because they come from outside. Unknown fields are ignored.
const idGroupSchema = z.object({
  idGroup: z.object({ rxnormId: z.array(z.string()).optional() }).optional(),
});

const approximateSchema = z.object({
  approximateGroup: z
    .object({
      candidate: z
        .array(z.object({ rxcui: z.string().optional(), score: z.string().optional() }))
        .optional(),
    })
    .optional(),
});

const propertiesSchema = z.object({
  properties: z.object({ rxcui: z.string(), name: z.string(), tty: z.string() }).optional(),
});

const relatedSchema = z.object({
  relatedGroup: z
    .object({
      conceptGroup: z
        .array(
          z.object({
            tty: z.string().optional(),
            conceptProperties: z
              .array(z.object({ rxcui: z.string(), name: z.string() }))
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

const RXCUI = /^\d{1,10}$/;
const MAX_CANDIDATES = 5;

/**
 * RxNorm name lookup through the public RxNav REST API (no key needed).
 *
 * Only name-to-concept and concept-to-ingredient lookups are used. The RxNav drug
 * interaction API was discontinued in January 2024 and is not called.
 */
export class RxNormNormalizer implements DrugNormalizer {
  public readonly name = 'RxNorm (NLM)';

  public constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike,
    private readonly timeoutMs = 8000,
  ) {}

  public async search(term: string): Promise<DrugCandidate[]> {
    const encoded = encodeURIComponent(term);
    const exact = idGroupSchema.parse(await this.get(`/rxcui.json?name=${encoded}&search=2`));
    const scored = new Map<string, number | null>();
    for (const id of exact.idGroup?.rxnormId ?? []) {
      scored.set(id, null);
    }
    if (scored.size === 0) {
      const approximate = approximateSchema.parse(
        await this.get(`/approximateTerm.json?term=${encoded}&maxEntries=8`),
      );
      for (const candidate of approximate.approximateGroup?.candidate ?? []) {
        const id = candidate.rxcui;
        if (id !== undefined && RXCUI.test(id) && !scored.has(id)) {
          const score = Number(candidate.score);
          scored.set(id, Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0);
        }
      }
    }
    const candidates: DrugCandidate[] = [];
    for (const [rxcui, score] of [...scored].slice(0, MAX_CANDIDATES)) {
      const concept = await this.resolve(rxcui);
      if (concept !== null) {
        candidates.push({ ...concept, score });
      }
    }
    return candidates;
  }

  public async resolve(rxcui: string): Promise<ResolvedConcept | null> {
    if (!RXCUI.test(rxcui)) {
      return null;
    }
    const properties = propertiesSchema.parse(await this.get(`/rxcui/${rxcui}/properties.json`));
    if (properties.properties === undefined) {
      return null;
    }
    const { name, tty } = properties.properties;
    let ingredients: Ingredient[];
    if (tty === 'IN') {
      ingredients = [{ rxcui, name }];
    } else {
      const related = relatedSchema.parse(await this.get(`/rxcui/${rxcui}/related.json?tty=IN`));
      ingredients = (related.relatedGroup?.conceptGroup ?? [])
        .filter((group) => group.tty === 'IN')
        .flatMap((group) => group.conceptProperties ?? [])
        .map((concept) => ({ rxcui: concept.rxcui, name: concept.name }));
    }
    return { rxcui, name, termType: tty, ingredients };
  }

  private async get(path: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`RxNorm answered ${String(response.status)}`);
      }
      return await response.json();
    } catch (error) {
      throw new ServiceUnavailableError(
        'The medicine name lookup is not available right now. You can still save the name as typed.',
        'name-lookup-unavailable',
      ).withCause(error);
    } finally {
      clearTimeout(timer);
    }
  }
}
