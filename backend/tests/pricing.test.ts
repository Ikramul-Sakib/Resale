import { describe, expect, it, vi } from 'vitest';
import { parsePriceEstimateResponse } from '../src/services/gemini/parser.js';
import { GeminiServiceError } from '../src/services/gemini/errors.js';
import { PricingService } from '../src/services/pricing/service.js';
import type { GeminiService } from '../src/services/gemini/types.js';
import type { Repositories } from '../src/repositories/contracts.js';

const valid = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  low: 20, typical: 30, high: 40, suggested_selling_price: 30, currency: 'USD',
  explanation: 'Condition and confirmed attributes support this preliminary range.', factors: [],
  methodology: 'AI preliminary estimate from confirmed item data only.', data_source: 'gemini_ai_estimate', uncertainty_note: null, ...overrides,
});

describe('price estimate parsing and pricing ownership', () => {
  it('accepts valid structured output and rejects malformed, out-of-order, and wrong-currency data', () => {
    expect(parsePriceEstimateResponse(valid(), 'USD').typical).toBe(30);
    expect(() => parsePriceEstimateResponse('{bad', 'USD')).toThrow(GeminiServiceError);
    expect(() => parsePriceEstimateResponse(valid({ low: 40, typical: 30 }), 'USD')).toThrow('out-of-order');
    expect(() => parsePriceEstimateResponse(valid({ currency: 'EUR' }), 'USD')).toThrow('different currency');
  });

  it('uses a short duplicate guard and never calls Gemini twice for a repeated click', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'estimate-1', low: 20, typical: 30, high: 40, suggested_price: 30, currency: 'USD', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), market_data_status: 'not_connected' });
    const recent = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'estimate-1', market_data_status: 'not_connected' });
    const gemini = { mode: 'mock', estimatePrice: vi.fn().mockResolvedValue({ low: 20, typical: 30, high: 40, suggested_selling_price: 30, currency: 'USD', explanation: 'mock', factors: [], methodology: 'mock', data_source: 'mock_demo_estimate', uncertainty_note: null }) } as unknown as GeminiService;
    const repositories = { items: { getById: vi.fn().mockResolvedValue({ id: 'item-1', scan_id: 'scan-1', review_status: 'reviewed', key_attributes: {} }) }, estimates: { findRecent: recent, create }, fees: { calculate: vi.fn() }, pricing: { history: vi.fn() } } as unknown as Repositories;
    const service = new PricingService(repositories, gemini, { status: 'not_connected', getObservations: vi.fn().mockResolvedValue([]) }, { promptVersion: 'pricing-v1' });
    await service.estimate('user-a', 'item-1', { currency: 'USD' });
    const cached = await service.estimate('user-a', 'item-1', { currency: 'USD' });
    expect(gemini.estimatePrice).toHaveBeenCalledTimes(1);
    expect(cached.cached).toBe(true);
  });

  it('enforces ownership through the repository boundary', async () => {
    const repositories = { items: { getById: vi.fn().mockRejectedValue(new Error('not found')) } } as unknown as Repositories;
    const service = new PricingService(repositories, {} as GeminiService, { status: 'not_connected', getObservations: vi.fn() }, { promptVersion: 'pricing-v1' });
    await expect(service.estimate('user-a', 'user-b-item', { currency: 'USD' })).rejects.toThrow('not found');
    expect(repositories.items.getById).toHaveBeenCalledWith('user-a', 'user-b-item');
  });
});
