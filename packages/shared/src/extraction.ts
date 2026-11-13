import { z } from 'zod';

export const MAX_LABEL_IMAGES = 3;
export const MAX_LABEL_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_LABEL_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type LabelMimeType = (typeof ALLOWED_LABEL_MIME_TYPES)[number];

/** Below this confidence the user is asked to check the reading extra carefully. */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

/**
 * What an extractor may return for one medicine on a label. This is plain data read from
 * the image. It is never treated as instructions and never contains clinical advice.
 */
export const extractedLabelSchema = z.object({
  name: z.string().trim().min(1).max(120),
  strengthText: z.string().trim().max(60).nullable(),
  form: z.string().trim().max(40).nullable(),
  rawText: z.string().max(2000),
  confidence: z.number().min(0).max(1),
});
export type ExtractedLabel = z.infer<typeof extractedLabelSchema>;

export const labelCandidateSchema = extractedLabelSchema.extend({
  /** Index of the uploaded image this reading came from. */
  imageIndex: z.number().int().min(0),
  needsReview: z.boolean(),
});
export type LabelCandidate = z.infer<typeof labelCandidateSchema>;

export const EXTRACTION_FAILURE_REASONS = ['unreadable', 'timeout', 'provider_error'] as const;
export type ExtractionFailureReason = (typeof EXTRACTION_FAILURE_REASONS)[number];

export const labelExtractionResponseSchema = z.object({
  candidates: z.array(labelCandidateSchema),
  /** Images that produced no usable reading. The user types those medicines by hand. */
  failures: z.array(
    z.object({
      imageIndex: z.number().int().min(0),
      reason: z.enum(EXTRACTION_FAILURE_REASONS),
    }),
  ),
  provider: z.string(),
  remainingToday: z.number().int(),
});
export type LabelExtractionResponse = z.infer<typeof labelExtractionResponseSchema>;
