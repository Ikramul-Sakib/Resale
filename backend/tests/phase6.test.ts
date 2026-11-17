import { describe, expect, it } from 'vitest';
import { GeminiServiceError, createGeminiService, parseIdentificationResponse } from '../src/services/gemini/index.js';
import { mapGeminiError } from '../src/services/gemini/errors.js';
import { validateUploadedImages } from '../src/services/image-validation.js';

const jpeg = () => Buffer.from([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]);
const png = () => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

describe('Phase 6 image and Gemini boundaries', () => {
  it('accepts real magic bytes even when the filename is misleading', () => {
    const result = validateUploadedImages([{ buffer: jpeg(), mimetype: 'application/octet-stream', originalname: 'not-a-jpg.txt' }]);
    expect(result[0]?.mimeType).toBe('image/jpeg');
  });

  it('rejects fake extensions and unsupported bytes', () => {
    expect(() => validateUploadedImages([{ buffer: Buffer.from('not an image'), mimetype: 'image/jpeg', originalname: 'fake.jpg' }])).toThrowError(/real JPG/);
  });

  it('rejects oversized and excessive uploads', () => {
    expect(() => validateUploadedImages([{ buffer: Buffer.alloc(10 * 1024 * 1024 + 1), originalname: 'large.png' }])).toThrowError(/10 MB/);
    expect(() => validateUploadedImages(Array.from({ length: 7 }, (_, index) => ({ buffer: png(), originalname: `${index}.png` })))).toThrowError(/up to 6/);
  });

  it('parses valid, fenced, and partial structured responses', () => {
    expect(parseIdentificationResponse(JSON.stringify({ product_name: 'Camera', brand: 'Acme', key_attributes: { color: 'black' }, confidence: 0.7 })).product_name).toBe('Camera');
    expect(parseIdentificationResponse('```json\n{"product_name":"Camera"}\n```').product_name).toBe('Camera');
    expect(parseIdentificationResponse('{"brand":"Unknown"}')).toMatchObject({ product_name: null, brand: 'Unknown', key_attributes: {} });
  });

  it('maps malformed, safety, and transient failures to safe errors', () => {
    expect(() => parseIdentificationResponse('{bad json')).toThrowError(GeminiServiceError);
    expect(mapGeminiError(new Error('429 quota exceeded'))).toMatchObject({ code: 'GEMINI_RATE_LIMITED', retryable: true });
    expect(mapGeminiError(new Error('safety blocked')).code).toBe('GEMINI_SAFETY_BLOCK');
  });

  it('uses a clearly labelled mock adapter without a Gemini key', async () => {
    const service = createGeminiService({ timeoutMs: 100, maxRetries: 0 });
    const result = await service.identifyProduct([{ bytes: jpeg(), mimeType: 'image/jpeg' }]);
    expect(service.mode).toBe('mock');
    expect(result.identification_notes).toContain('Demo mock result');
  });
});
