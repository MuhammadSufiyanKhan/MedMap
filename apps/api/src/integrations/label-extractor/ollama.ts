import { z } from 'zod';
import type { ExtractedLabel } from '@medmap/shared';
import {
  EXTRACTION_JSON_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_PROMPT,
  parseExtraction,
  parseJsonText,
} from './extractor.js';
import type { LabelExtractor } from './extractor.js';

export type ExtractorFetch = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const responseSchema = z.object({ message: z.object({ content: z.string() }) });

/**
 * Local development adapter for an Ollama server with a vision model. The model name
 * comes from configuration; none is built in.
 */
export class OllamaExtractor implements LabelExtractor {
  public readonly name = 'Ollama (local)';

  public constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly fetchImpl: ExtractorFetch,
  ) {}

  public async extract(
    image: Buffer,
    _mime: string,
    signal: AbortSignal,
  ): Promise<ExtractedLabel[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: EXTRACTION_JSON_SCHEMA,
        options: { temperature: 0 },
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: EXTRACTION_USER_PROMPT, images: [image.toString('base64')] },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`extraction provider answered ${String(response.status)}`);
    }
    const body = responseSchema.parse(await response.json());
    return parseExtraction(parseJsonText(body.message.content));
  }
}
