import type { RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { MAX_LABEL_IMAGE_BYTES, MAX_LABEL_IMAGES } from '@medmap/shared';
import {
  BadRequestError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from '../utils/errors.js';

export const LABEL_UPLOAD_FIELD = 'images';

/**
 * Multipart parser for label photos.
 *
 * Files are held in memory only (never written to disk), limited to 5 MB each and three
 * per request, and no other form fields are accepted. Runs after authentication.
 */
export function createLabelUpload(): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_LABEL_IMAGE_BYTES,
      files: MAX_LABEL_IMAGES,
      fields: 0,
      parts: MAX_LABEL_IMAGES,
    },
  }).array(LABEL_UPLOAD_FIELD, MAX_LABEL_IMAGES);

  return (req, res, next) => {
    if (!req.is('multipart/form-data')) {
      next(
        new UnsupportedMediaTypeError('Send photos as multipart/form-data in the "images" field.'),
      );
      return;
    }
    upload(req, res, (error: unknown) => {
      if (error === undefined || error === null) {
        next();
        return;
      }
      if (error instanceof MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          next(new PayloadTooLargeError('Each photo can be up to 5 MB.'));
          return;
        }
        if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_PART_COUNT') {
          next(
            new PayloadTooLargeError(`Send at most ${String(MAX_LABEL_IMAGES)} photos at a time.`),
          );
          return;
        }
        next(
          new BadRequestError('Only photos in the "images" field are accepted.', 'invalid-upload'),
        );
        return;
      }
      next(new BadRequestError('The upload could not be read.', 'invalid-upload'));
    });
  };
}
