import { ALLOWED_LABEL_MIME_TYPES, MAX_LABEL_IMAGE_BYTES, MAX_LABEL_IMAGES } from '@medmap/shared';
import type { ExtractionFailureReason } from '@medmap/shared';
import { formatMegabytes } from './format';

export interface PhotoInfo {
  name: string;
  size: number;
  type: string;
}

/**
 * Checks chosen photos before upload so problems are explained at once.
 * The server repeats every check; this is only for a faster, clearer message.
 * @returns a message for the user, or null when the selection is fine.
 */
export function validatePhotos(photos: readonly PhotoInfo[]): string | null {
  if (photos.length === 0) {
    return 'Choose at least one photo.';
  }
  if (photos.length > MAX_LABEL_IMAGES) {
    return `Choose up to ${String(MAX_LABEL_IMAGES)} photos at a time.`;
  }
  for (const photo of photos) {
    if (photo.size > MAX_LABEL_IMAGE_BYTES) {
      return `${photo.name} is ${formatMegabytes(photo.size)}. Each photo can be up to ${formatMegabytes(MAX_LABEL_IMAGE_BYTES)}.`;
    }
    if (
      photo.type !== '' &&
      !(ALLOWED_LABEL_MIME_TYPES as readonly string[]).includes(photo.type)
    ) {
      return `${photo.name} is not a JPEG, PNG or WebP photo.`;
    }
  }
  return null;
}

export const FAILURE_TEXT: Record<ExtractionFailureReason, string> = {
  unreadable: 'No medicine name could be read from this photo.',
  timeout: 'Reading this photo took too long.',
  provider_error: 'This photo could not be read right now.',
};
