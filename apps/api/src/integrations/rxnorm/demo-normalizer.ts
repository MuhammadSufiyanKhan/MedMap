import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { z } from 'zod';
import type { DrugCandidate } from '@medmap/shared';
import type { DrugNormalizer, ResolvedConcept } from './normalizer.js';

const demoDrugsSchema = z.object({
  concepts: z.array(
    z.object({
      rxcui: z.string().regex(/^DEMO-\d{4}$/),
      name: z.string(),
      termType: z.string(),
      ingredients: z.array(z.string()),
    }),
  ),
});

/** Path of a fixture file shipped in the shared package. */
export function sharedFixturePath(file: string): string {
  return createRequire(import.meta.url).resolve(`@medmap/shared/fixtures/${file}`);
}

/**
 * Looks names up in the invented demo catalogue. It is only consulted while the active
 * interaction dataset is the demo set, so made-up names never mix with real data.
 */
export class DemoNormalizer implements DrugNormalizer {
  public readonly name = 'MedMap demo names';
  private readonly concepts: Map<string, ResolvedConcept>;

  public constructor(fixturePath: string = sharedFixturePath('demo-drugs.json')) {
    const parsed = demoDrugsSchema.parse(JSON.parse(readFileSync(fixturePath, 'utf8')));
    const names = new Map(parsed.concepts.map((concept) => [concept.rxcui, concept.name]));
    this.concepts = new Map(
      parsed.concepts.map((concept) => [
        concept.rxcui,
        {
          rxcui: concept.rxcui,
          name: concept.name,
          termType: concept.termType,
          ingredients: concept.ingredients.map((rxcui) => ({
            rxcui,
            name: names.get(rxcui) ?? rxcui,
          })),
        },
      ]),
    );
  }

  public search(term: string): Promise<DrugCandidate[]> {
    const needle = term.trim().toLowerCase();
    const matches: DrugCandidate[] = [];
    for (const concept of this.concepts.values()) {
      const name = concept.name.toLowerCase();
      if (name === needle) {
        matches.unshift({ ...concept, score: null });
      } else if (needle.length >= 3 && (name.includes(needle) || needle.includes(name))) {
        matches.push({ ...concept, score: 80 });
      }
    }
    return Promise.resolve(matches.slice(0, 5));
  }

  public resolve(rxcui: string): Promise<ResolvedConcept | null> {
    return Promise.resolve(this.concepts.get(rxcui) ?? null);
  }
}
