import { describe, expect, it, vi } from 'vitest';
import { parseListingGenerationResponse } from '../src/services/gemini/parser.js';
import { ListingService } from '../src/services/listings.js';
import { AppError } from '../src/utils/errors.js';
import type { GeminiService } from '../src/services/gemini/types.js';
import type { Repositories } from '../src/repositories/contracts.js';

const listing = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  title: 'Confirmed Keyboard K2', description: 'A confirmed product description.', condition_description: 'Good condition as confirmed by the seller.',
  selling_points: ['Confirmed model'], suggested_price: 30, currency: 'BDT', keywords: ['keyboard', 'k2'], ...overrides,
});

describe('listing generation', () => {
  it('parses valid JSON and rejects partial, malformed, overlong, and price-changing output', () => {
    expect(parseListingGenerationResponse(listing(), { currency: 'BDT', suggestedPrice: 30, titleMaxLength: 40 }).title).toBe('Confirmed Keyboard K2');
    expect(() => parseListingGenerationResponse('{bad', { currency: 'BDT', suggestedPrice: 30, titleMaxLength: 40 })).toThrow();
    expect(() => parseListingGenerationResponse(JSON.stringify({ title: 'Only title' }), { currency: 'BDT', suggestedPrice: 30, titleMaxLength: 40 })).toThrow();
    expect(() => parseListingGenerationResponse(listing({ title: 'This confirmed title is much too long' }), { currency: 'BDT', suggestedPrice: 30, titleMaxLength: 10 })).toThrow('title');
    expect(() => parseListingGenerationResponse(listing({ suggested_price: 31 }), { currency: 'BDT', suggestedPrice: 30, titleMaxLength: 40 })).toThrow('price');
  });

  it('uses confirmed item ownership and protects rapid duplicate generation calls', async () => {
  const gemini = { mode: 'mock', generateListing: vi.fn().mockResolvedValue({ title: 'Product', description: 'Confirmed facts only.', condition_description: 'To be confirmed.', selling_points: ['Product'], suggested_price: 30, currency: 'BDT', keywords: ['product'] }) } as unknown as GeminiService;
    const repositories = {
      reference: { getMarketplaceById: vi.fn().mockResolvedValue({ id: 'market-1', name: 'Demo', title_max_length: 40 }) },
      inventory: { getById: vi.fn().mockRejectedValue(new AppError(404, 'NOT_FOUND', 'Inventory item was not found.')) },
      items: { getById: vi.fn().mockResolvedValue({ id: 'item-1', name: 'Confirmed product', review_status: 'reviewed', key_attributes: {}, condition: 'Good' }) },
    estimates: { findLatestForItem: vi.fn().mockResolvedValue({ id: 'estimate-1', suggested_price: 30, currency: 'BDT' }) },
    } as unknown as Repositories;
    const service = new ListingService(repositories, gemini);
    await service.generate('user-a', { item_id: 'item-1', marketplace_id: 'market-1', currency: 'BDT', tone: 'neutral' });
    await expect(service.generate('user-a', { item_id: 'item-1', marketplace_id: 'market-1', currency: 'BDT', tone: 'neutral' })).rejects.toMatchObject({ code: 'GENERATION_TOO_FREQUENT' });
    expect(gemini.generateListing).toHaveBeenCalledTimes(1);
    expect(repositories.items.getById).toHaveBeenCalledWith('user-a', 'item-1');
  });

  it('records an audit event when a draft is saved', async () => {
    const audit = vi.fn().mockResolvedValue(undefined);
    const draft = { id: 'draft-1', title: 'Draft', attributes: {}, status: 'draft' };
    const repositories = { listings: { create: vi.fn().mockResolvedValue(draft) }, audit: { create: audit }, reference: { getMarketplaceById: vi.fn().mockResolvedValue({ id: 'market-1', name: 'Demo', title_max_length: 40 }) } } as unknown as Repositories;
    const service = new ListingService(repositories, {} as GeminiService);
    await service.create('user-a', { identified_item_id: 'item-1', marketplace_id: 'market-1', title: 'Draft', attributes: {}, status: 'draft' });
    expect(audit).toHaveBeenCalledWith('user-a', 'listing_draft_created', 'listing_draft', 'draft-1', expect.any(Object));
  });
});
