import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';
import { MAX_IMAGE_BYTES, MAX_IMAGE_COUNT } from '../services/image-validation.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_IMAGE_COUNT, fileSize: MAX_IMAGE_BYTES, fields: 10, fieldNameSize: 100 },
});

export function scanUpload(req: Request, res: Response, next: NextFunction): void {
  upload.array('images', MAX_IMAGE_COUNT)(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new AppError(413, 'IMAGE_TOO_LARGE', 'Each image must be 10 MB or smaller.'));
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_COUNT') return next(new AppError(400, 'TOO_MANY_IMAGES', `You can upload up to ${MAX_IMAGE_COUNT} images.`));
    return next(new AppError(400, 'INVALID_UPLOAD', 'The image upload could not be read.'));
  });
}
