import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { z } from 'zod';
import { extractedLabelSchema } from '@medmap/shared';
import type { ExtractedLabel } from '@medmap/shared';
import { sharedFixturePath } from '../rxnorm/demo-normalizer.js';
import type { LabelExtractor } from './extractor.js';

const manifestSchema = z.object({
  labels: z.array(
    z.object({
      file: z.string(),
      width: z.number().int(),
      height: z.number().int(),
      expected: z.array(extractedLabelSchema),
    }),
  ),
});

export type LabelManifest = z.infer<typeof manifestSchema>;

export function loadLabelManifest(path = sharedFixturePath('labels/labels.json')): LabelManifest {
  return manifestSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

/**
 * Test and demo extractor. It does no reading at all: it recognises the synthetic fixture
 * images by their pixel dimensions (each fixture has a unique size) and returns the answer
 * recorded for them. Any other image yields nothing, which exercises the "could not read"
 * path. It is refused in production by the configuration check.
 */
export class MockExtractor implements LabelExtractor {
  public readonly name = 'mock (fixtures only)';
  private readonly answers: Map<string, ExtractedLabel[]>;

  public constructor(manifest: LabelManifest = loadLabelManifest()) {
    this.answers = new Map(
      manifest.labels.map((label) => [
        `${String(label.width)}x${String(label.height)}`,
        label.expected,
      ]),
    );
  }

  public async extract(image: Buffer): Promise<ExtractedLabel[]> {
    const metadata = await sharp(image).metadata();
    return this.answers.get(`${String(metadata.width)}x${String(metadata.height)}`) ?? [];
  }
}
