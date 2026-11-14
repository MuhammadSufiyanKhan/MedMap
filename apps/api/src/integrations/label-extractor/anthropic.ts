import { z } from 'zod';
import type { ExtractedLabel, LabelMimeType } from '@medmap/shared';
import {
  EXTRACTION_JSON_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_PROMPT,
  parseExtraction,
} from './extractor.js';
import type { LabelExtractor } from './extractor.js';
import type { ExtractorFetch } from './ollama.js';

const TOOL_NAME = 'record_label';
const DEFAULT_BASE_URL = 'https://api.anthropic.com';

const responseSchema = z.object({
  content: z.array(
    z.object({ type: z.string(), name: z.string().optional(), input: z.unknown().optional() }),
  ),
});

/**
 * Hosted vision adapter using the Anthropic Messages API. The model is forced to answer
 * through one tool whose input schema is the extraction structure, so the reply is
 * structured data and not prose. Model name and key come from configuration.
 */
export class AnthropicExtractor implements LabelExtractor {
  public readonly name = 'Anthropic (hosted)';

  public constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: ExtractorFetch,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  public async extract(
    image: Buffer,
    mime: LabelMimeType,
    signal: AbortSignal,
  ): Promise<ExtractedLabel[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal,
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system: EXTRACTION_SYSTEM_PROMPT,
        tools: [
          {
            name: TOOL_NAME,
            description: 'Record the medicines transcribed from the label photo.',
            input_schema: EXTRACTION_JSON_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: TOOL_NAME },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mime, data: image.toString('base64') },
              },
              { type: 'text', text: EXTRACTION_USER_PROMPT },
            ],
          },
        ],
      }),
    });
    if (!response.ok) {
      // The status is enough for logs. The body is not read, so nothing sensitive is kept.
      throw new Error(`extraction provider answered ${String(response.status)}`);
    }
    const body = responseSchema.parse(await response.json());
    const toolUse = body.content.find(
      (block) => block.type === 'tool_use' && block.name === TOOL_NAME,
    );
    return parseExtraction(toolUse?.input);
  }
}
