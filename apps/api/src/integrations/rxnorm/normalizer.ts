import type { DrugCandidate, Ingredient } from '@medmap/shared';

/** A drug concept resolved to its active ingredients. */
export interface ResolvedConcept {
  rxcui: string;
  name: string;
  termType: string;
  ingredients: Ingredient[];
}

/**
 * Port for turning a typed or scanned name into a drug concept with ingredients.
 * Adapters only look names up. They never return clinical content.
 */
export interface DrugNormalizer {
  /** Shown in the UI as the source of the name match. */
  readonly name: string;
  /** Candidates for a free-text term, best first. An empty list means no match. */
  search(term: string): Promise<DrugCandidate[]>;
  /** The concept for an id, or null when this adapter does not know it. */
  resolve(rxcui: string): Promise<ResolvedConcept | null>;
}

/** Tries each normaliser in order and merges their answers. */
export class CompositeNormalizer implements DrugNormalizer {
  public constructor(private readonly normalizers: DrugNormalizer[]) {}

  public get name(): string {
    return this.normalizers.map((normalizer) => normalizer.name).join(' + ') || 'none';
  }

  public async search(term: string): Promise<DrugCandidate[]> {
    const seen = new Set<string>();
    const merged: DrugCandidate[] = [];
    for (const normalizer of this.normalizers) {
      for (const candidate of await normalizer.search(term)) {
        if (!seen.has(candidate.rxcui)) {
          seen.add(candidate.rxcui);
          merged.push(candidate);
        }
      }
    }
    return merged;
  }

  public async resolve(rxcui: string): Promise<ResolvedConcept | null> {
    for (const normalizer of this.normalizers) {
      const concept = await normalizer.resolve(rxcui);
      if (concept !== null) {
        return concept;
      }
    }
    return null;
  }
}
