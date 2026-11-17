import { AppError } from '../utils/errors.js';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_COUNT = 6;
export type SupportedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface UploadedImage {
  buffer: Buffer;
  mimeType: SupportedImageMime;
  originalName: string;
  size: number;
}

export function detectImageMime(buffer: Buffer): SupportedImageMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).equals(buffer.subarray(0, 8))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export function validateUploadedImages(files: Array<{ buffer: Buffer; mimetype?: string; originalname: string; size?: number }>): UploadedImage[] {
  if (files.length < 1) throw new AppError(400, 'IMAGE_REQUIRED', 'Add at least one JPG, PNG, or WebP image.');
  if (files.length > MAX_IMAGE_COUNT) throw new AppError(400, 'TOO_MANY_IMAGES', `You can upload up to ${MAX_IMAGE_COUNT} images.`);
  return files.map((file) => {
    const size = file.size ?? file.buffer.length;
    if (size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) throw new AppError(413, 'IMAGE_TOO_LARGE', 'Each image must be 10 MB or smaller.');
    const mimeType = detectImageMime(file.buffer);
    if (!mimeType) throw new AppError(400, 'INVALID_IMAGE_TYPE', 'Only real JPG, PNG, and WebP images are accepted.');
    return { buffer: file.buffer, mimeType, originalName: file.originalname, size: file.buffer.length };
  });
}
