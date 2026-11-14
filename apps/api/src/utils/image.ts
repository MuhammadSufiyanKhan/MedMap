import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { ALLOWED_LABEL_MIME_TYPES } from '@medmap/shared';
import type { LabelMimeType } from '@medmap/shared';
import { UnsupportedMediaTypeError } from './errors.js';

const MAX_DIMENSION = 1600;
const MAX_INPUT_PIXELS = 40_000_000;

function isAllowed(mime: string): mime is LabelMimeType {
  return (ALLOWED_LABEL_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Checks and cleans an uploaded image in memory.
 *
 * - The type is decided from the file's magic bytes; the client's Content-Type and file
 *   name are ignored.
 * - The image is decoded and re-encoded as JPEG. Re-encoding drops EXIF and every other
 *   metadata block (location, device, timestamps) and neutralises files that are not
 *   really images.
 * - Very large images are scaled down, which also bounds what is sent to the provider.
 *
 * @throws UnsupportedMediaTypeError when the bytes are not a JPEG, PNG or WebP image, or
 * cannot be decoded.
 */
export async function sanitizeImage(
  input: Buffer,
): Promise<{ buffer: Buffer; mime: LabelMimeType }> {
  const detected = await fileTypeFromBuffer(input);
  if (detected === undefined || !isAllowed(detected.mime)) {
    throw new UnsupportedMediaTypeError('Photos must be JPEG, PNG or WebP images.');
  }
  try {
    const buffer = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
      // Apply the EXIF orientation to the pixels before the metadata is dropped.
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88 })
      .toBuffer();
    return { buffer, mime: 'image/jpeg' };
  } catch {
    throw new UnsupportedMediaTypeError('This photo could not be opened. Try taking it again.');
  }
}
