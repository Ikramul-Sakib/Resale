import { randomUUID } from 'node:crypto';
import type { Repositories, ScanListOptions, ScanRecord } from '../repositories/contracts.js';
import { AppError } from '../utils/errors.js';
import { GeminiServiceError, type GeminiService, type IdentificationResult, type ImageInput } from './gemini/index.js';
import { validateUploadedImages, type UploadedImage } from './image-validation.js';

export interface ScanUploadFile {
  buffer: Buffer;
  mimetype?: string;
  originalname: string;
  size?: number;
}

export interface ScanResult extends ScanRecord {
  ai_mode: 'real' | 'mock';
  identification_empty: boolean;
}

function extension(mimeType: UploadedImage['mimeType']): string {
  return mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
}

function safeOriginalName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
  return clean || 'image';
}

function resultToPatch(result: IdentificationResult) {
  return {
    name: result.product_name ?? 'Unknown item',
    brand_text: result.brand,
    model: result.model,
    category_text: result.category,
    product_type: result.product_type,
    condition: result.visible_condition,
    key_attributes: result.key_attributes,
    identification_notes: result.identification_notes,
    review_status: 'needs_review' as const,
  };
}

function mapGeminiFailure(error: unknown): AppError {
  if (error instanceof GeminiServiceError) {
    const status = error.code === 'GEMINI_RATE_LIMITED' ? 429 : error.code === 'GEMINI_SAFETY_BLOCK' ? 422 : 502;
    return new AppError(status, error.code, error.message);
  }
  return new AppError(502, 'GEMINI_FAILED', 'Product identification could not be completed.');
}

export class ScanService {
  constructor(private readonly repositories: Repositories, private readonly gemini: GeminiService) {}

  private async decorate(userId: string, scan: ScanRecord): Promise<ScanResult> {
    const images = await this.repositories.scans.getImages(userId, scan.id);
    const signedImages = await Promise.all(images.map(async (image) => ({ ...image, signed_url: await this.repositories.scans.signImage(image.storage_path) })));
    const identifiedItem = await this.repositories.scans.getIdentifiedItem(userId, scan.id);
    return {
      ...scan,
      images: signedImages,
      identified_item: identifiedItem,
      ai_mode: this.gemini.mode,
      identification_empty: !identifiedItem || identifiedItem.name === 'Unknown item',
    };
  }

  async list(userId: string, options: ScanListOptions) {
    const page = await this.repositories.scans.list(userId, options);
    return { ...page, data: await Promise.all(page.data.map((row) => this.decorate(userId, row as ScanRecord))) };
  }

  async get(userId: string, scanId: string): Promise<ScanResult> {
    return this.decorate(userId, await this.repositories.scans.getById(userId, scanId) as ScanRecord);
  }

  async create(userId: string, files: ScanUploadFile[], source: 'upload' | 'camera' = 'upload'): Promise<ScanResult> {
    const images = validateUploadedImages(files);
    const scan = await this.repositories.scans.create(userId, source);
    const storagePaths: string[] = [];
    let imagesPersisted = false;
    try {
      for (const [index, image] of images.entries()) {
        const path = `${userId}/${scan.id}/${randomUUID()}.${extension(image.mimeType)}`;
        await this.repositories.scans.uploadStorage(path, image.buffer, image.mimeType);
        storagePaths.push(path);
        await this.repositories.scans.addImage(userId, {
          scan_id: scan.id,
          user_id: userId,
          storage_path: path,
          original_filename: safeOriginalName(image.originalName),
          mime_type: image.mimeType,
          byte_size: image.size,
          sort_order: index,
          metadata: {},
        });
      }
      imagesPersisted = true;
      await this.repositories.scans.updateStatus(userId, scan.id, 'identifying');
      const result = await this.gemini.identifyProduct(images.map((image): ImageInput => ({ bytes: image.buffer, mimeType: image.mimeType })));
      await this.repositories.scans.createIdentifiedItem(userId, scan.id, result, this.gemini.mode === 'mock');
      await this.repositories.scans.updateStatus(userId, scan.id, 'completed');
      return this.get(userId, scan.id);
    } catch (error) {
      if (imagesPersisted) {
        const failure = error instanceof GeminiServiceError ? mapGeminiFailure(error) : error instanceof AppError ? error : new AppError(502, 'SCAN_FAILED', 'The scan could not be completed.');
        try { await this.repositories.scans.updateStatus(userId, scan.id, 'failed', failure.message); } catch { /* Preserve the original safe error. */ }
        throw new AppError(failure.statusCode, failure.code, failure.message, { scan_id: scan.id });
      }
      try { await this.repositories.scans.deleteStorage(storagePaths); } catch { /* Best-effort cleanup. */ }
      try { await this.repositories.scans.deleteScan(userId, scan.id); } catch { /* Best-effort cleanup. */ }
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'SCAN_FAILED', 'The scan could not be uploaded securely.');
    }
  }

  async retry(userId: string, scanId: string): Promise<ScanResult> {
    const scan = await this.repositories.scans.getById(userId, scanId) as ScanRecord;
    if (scan.status !== 'failed') throw new AppError(409, 'SCAN_NOT_RETRYABLE', 'Only failed scans can be retried.');
    const images = await this.repositories.scans.getImages(userId, scanId);
    if (!images.length) throw new AppError(409, 'SCAN_IMAGES_MISSING', 'This scan has no images available for retry.');
    await this.repositories.scans.updateStatus(userId, scanId, 'identifying', null);
    try {
      const inputs = await Promise.all(images.map((image) => this.repositories.scans.getImageBytes(userId, image.storage_path)));
      const result = await this.gemini.identifyProduct(inputs);
      const existing = await this.repositories.scans.getIdentifiedItem(userId, scanId);
      if (existing?.id) await this.repositories.scans.updateIdentifiedItem(userId, String(existing.id), resultToPatch(result));
      else await this.repositories.scans.createIdentifiedItem(userId, scanId, result, this.gemini.mode === 'mock');
      await this.repositories.scans.updateStatus(userId, scanId, 'completed', null);
      return this.get(userId, scanId);
    } catch (error) {
      const failure = error instanceof GeminiServiceError ? mapGeminiFailure(error) : error instanceof AppError ? error : new AppError(502, 'SCAN_FAILED', 'The scan could not be completed.');
      try { await this.repositories.scans.updateStatus(userId, scanId, 'failed', failure.message); } catch { /* Preserve the original safe error. */ }
      throw new AppError(failure.statusCode, failure.code, failure.message, { scan_id: scanId });
    }
  }
}
