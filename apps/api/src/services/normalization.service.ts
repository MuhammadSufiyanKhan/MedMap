import { z } from 'zod';
import { drugCandidateSchema, ingredientSchema } from '@medmap/shared';
import type { NormalizeResponse } from '@medmap/shared';
import { NORMALIZATION_CACHE_TTL_DAYS } from '../config/constants.js';
import type { InteractionSource } from '../engine/types.js';
import { CompositeNormalizer } from '../integrations/rxnorm/normalizer.js';
import type { DrugNormalizer, ResolvedConcept } from '../integrations/rxnorm/normalizer.js';
import type { CacheRepository } from '../repositories/cache.repository.js';
import { addDays } from '../utils/clock.js';
import type { Clock } from '../utils/clock.js';

const cachedSearchSchema = z.array(drugCandidateSchema);
const cachedConceptSchema = z
  .object({
    rxcui: z.string(),
    name: z.string(),
    termType: z.string(),
    ingredients: z.array(ingredientSchema),
  })
  .nullable();

/**
 * Matches names to drug concepts and concepts to ingredients, with a cache in front.
 *
 * The invented demo names are consulted only while the active interaction dataset is the
 * demo set, so they can never appear next to real data.
 */
export class NormalizationService {
  public constructor(
    private readonly real: DrugNormalizer | null,
    private readonly demo: DrugNormalizer,
    private readonly source: InteractionSource,
    private readonly cache: CacheRepository,
    private readonly clock: Clock,
  ) {}

  /** @throws ServiceUnavailableError when the lookup service cannot be reached. */
  public async search(term: string): Promise<NormalizeResponse> {
    const { normalizer, mode } = await this.current();
    const key = `search:${mode}:${term.toLowerCase()}`;
    const cached = cachedSearchSchema.safeParse(await this.cache.get(key, this.clock()));
    if (cached.success) {
      return { term, candidates: cached.data, source: normalizer.name };
    }
    const candidates = await normalizer.search(term);
    await this.cache.set(key, candidates, this.expiry());
    return { term, candidates, source: normalizer.name };
  }

  /**
   * @returns the concept with its ingredients, or null when the id is unknown.
   * @throws ServiceUnavailableError when the lookup service cannot be reached.
   */
  public async resolve(rxcui: string): Promise<ResolvedConcept | null> {
    const { normalizer, mode } = await this.current();
    const key = `concept:${mode}:${rxcui}`;
    const raw = await this.cache.get(key, this.clock());
    if (raw !== undefined) {
      const cached = cachedConceptSchema.safeParse(raw);
      if (cached.success) {
        return cached.data;
      }
    }
    const concept = await normalizer.resolve(rxcui);
    await this.cache.set(key, concept, this.expiry());
    return concept;
  }

  private async current(): Promise<{ normalizer: DrugNormalizer; mode: string }> {
    const dataset = await this.source.getActiveDataset();
    const demoActive = dataset?.kind === 'demo';
    const parts: DrugNormalizer[] = [];
    if (demoActive) {
      parts.push(this.demo);
    }
    if (this.real !== null) {
      parts.push(this.real);
    }
    return {
      normalizer: new CompositeNormalizer(parts),
      mode: `${demoActive ? 'demo' : 'real'}-${this.real === null ? 'offline' : 'online'}`,
    };
  }

  private expiry(): Date {
    return addDays(this.clock(), NORMALIZATION_CACHE_TTL_DAYS);
  }
}
