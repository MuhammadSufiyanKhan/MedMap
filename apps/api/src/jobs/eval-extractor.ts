import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadConfig } from '../config/env.js';
import { AnthropicExtractor } from '../integrations/label-extractor/anthropic.js';
import type { LabelExtractor } from '../integrations/label-extractor/extractor.js';
import { loadLabelManifest, MockExtractor } from '../integrations/label-extractor/mock.js';
import { OllamaExtractor } from '../integrations/label-extractor/ollama.js';
import { sharedFixturePath } from '../integrations/rxnorm/demo-normalizer.js';
import { scoreExtraction, summariseScores } from '../services/extraction-eval.js';
import type { FieldScores } from '../services/extraction-eval.js';
import { sanitizeImage } from '../utils/image.js';

/**
 * Runs the configured extractor over the synthetic label fixtures and reports field-level
 * accuracy. With LABEL_EXTRACTOR=mock the numbers only prove the pipeline works, because
 * the mock returns recorded answers; use a real adapter to measure a model.
 */
async function main(): Promise<void> {
  const config = loadConfig({
    MONGODB_URI: 'mongodb://localhost/unused',
    JWT_ACCESS_SECRET: 'extractor-eval-placeholder-secret-000',
    ...process.env,
  });
  const { adapter, baseUrl, model, apiKey, timeoutMs } = config.extraction;
  let extractor: LabelExtractor = new MockExtractor();
  if (adapter === 'ollama' && baseUrl !== undefined && model !== undefined) {
    extractor = new OllamaExtractor(baseUrl, model, (url, init) => fetch(url, init));
  } else if (adapter === 'anthropic' && apiKey !== undefined && model !== undefined) {
    extractor = new AnthropicExtractor(apiKey, model, (url, init) => fetch(url, init), baseUrl);
  }

  const manifestPath = sharedFixturePath('labels/labels.json');
  const manifest = loadLabelManifest(manifestPath);
  const scores: FieldScores[] = [];
  process.stdout.write(`extractor: ${extractor.name}\n`);
  for (const label of manifest.labels) {
    const image = await sanitizeImage(readFileSync(join(dirname(manifestPath), label.file)));
    let actual: Awaited<ReturnType<LabelExtractor['extract']>> = [];
    try {
      actual = await extractor.extract(image.buffer, image.mime, AbortSignal.timeout(timeoutMs));
    } catch {
      process.stdout.write(`  ${label.file}: provider error\n`);
    }
    const score = scoreExtraction(label.expected, actual);
    scores.push(score);
    process.stdout.write(
      `  ${label.file}: name ${score.name ? 'ok' : 'MISS'}, strength ${score.strength ? 'ok' : 'MISS'}, form ${score.form ? 'ok' : 'MISS'}\n`,
    );
  }
  const summary = summariseScores(scores);
  process.stdout.write(
    `accuracy over ${String(summary.count)} labels: name ${String(summary.name)}%, strength ${String(summary.strength)}%, form ${String(summary.form)}%\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'failed'}\n`);
  process.exit(1);
});
