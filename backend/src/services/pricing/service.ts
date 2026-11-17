import type { Repositories, EstimateRequestInput, PricingHistoryOptions } from '../../repositories/contracts.js';
import type { Page } from '../../types/index.js';
import { AppError } from '../../utils/errors.js';
import type { GeminiService, ConfirmedPricingItem } from '../gemini/types.js';
import type { MarketDataProvider } from './market-data.js';

export interface PricingServiceOptions {
  modelId?: string;
  promptVersion: string;
}

export interface EstimateView {
  estimate: Record<string, unknown>;
  ai_mode: 'real' | 'mock';
  market_data_status: 'not_connected' | 'connected';
  fee: { status: string; fee_amount: number; rule?: unknown } | null;
  cached?: boolean;
}

function text(value: unknown, max = 600): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = [...value].filter((character) => { const code = character.charCodeAt(0); return code >= 32 && code !== 127; }).join('').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

export class PricingService {
  constructor(private readonly repositories: Repositories, private readonly gemini: GeminiService, private readonly marketData: MarketDataProvider, private readonly options: PricingServiceOptions) {}

  async estimate(userId: string, itemId: string, input: EstimateRequestInput): Promise<EstimateView> {
    const item = await this.repositories.items.getById(userId, itemId);
    if (item.review_status !== 'reviewed') throw new AppError(409, 'ITEM_REVIEW_REQUIRED', 'Confirm the item details before requesting a price estimate.');
    const currency = input.currency.toUpperCase();
    if (!input.force) {
      const recent = await this.repositories.estimates.findRecent(userId, itemId, currency, new Date(Date.now() - 60_000).toISOString());
      if (recent) return { estimate: recent, ai_mode: this.gemini.mode, market_data_status: String(recent.market_data_status ?? 'not_connected') as 'not_connected' | 'connected', fee: recent.estimated_fee_amount == null ? null : { status: String(recent.fee_rule_status ?? 'not_verified'), fee_amount: Number(recent.estimated_fee_amount) } , cached: true };
    }

    const attrs = (item.key_attributes && typeof item.key_attributes === 'object') ? item.key_attributes as Record<string, unknown> : {};
    const confirmed: ConfirmedPricingItem = {
      brand: text(item.brand_text), model: text(item.model), category: text(item.category_text), productType: text(item.product_type),
      age: text(attrs.age), condition: text(item.condition), visibleDamageOrWear: text(attrs.visible_damage_or_wear),
      originalPackaging: text(attrs.original_packaging), accessories: text(attrs.accessories), keyAttributes: attrs,
      purchasePrice: input.purchase_price ?? null, currency,
    };
    const result = await this.gemini.estimatePrice(confirmed);
    const observations = await this.marketData.getObservations(confirmed);
    const marketStatus = observations.length ? 'connected' : this.marketData.status;
    let fee: EstimateView['fee'] = null;
    if (input.marketplace_id) {
      try {
        const calculated = await this.repositories.fees.calculate({ marketplace_id: input.marketplace_id, sale_price: result.suggested_selling_price, currency });
        fee = { status: calculated.status ?? 'verified', fee_amount: calculated.fee_amount, rule: calculated.rule };
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== 'FEE_RULE_UNAVAILABLE') throw error;
        fee = { status: 'not_verified', fee_amount: 0 };
      }
    }
    const row = await this.repositories.estimates.create(userId, {
      identified_item_id: itemId, scan_id: String(item.scan_id), low: result.low, typical: result.typical, high: result.high,
      suggested_selling_price: result.suggested_selling_price, currency, explanation: result.explanation, methodology: result.methodology,
      factors: { items: result.factors }, data_source: this.gemini.mode === 'mock' ? 'mock_demo_estimate' : 'gemini_ai_estimate',
      model_id: this.options.modelId ?? null, prompt_version: this.options.promptVersion, uncertainty_note: result.uncertainty_note,
      marketplace_id: input.marketplace_id ?? null, purchase_price: input.purchase_price ?? null, purchase_currency: input.purchase_price == null ? null : currency,
      market_data_status: marketStatus, fee_rule_status: fee?.status === 'verified' ? 'verified' : 'not_verified', live_market_data_used: false,
      suggested_price: result.suggested_selling_price, estimated_fee_amount: fee?.fee_amount ?? null,
      estimated_net_earnings: fee ? Math.max(0, result.suggested_selling_price - fee.fee_amount) : null,
    });
    return { estimate: row, ai_mode: this.gemini.mode, market_data_status: marketStatus, fee };
  }

  history(userId: string, options: PricingHistoryOptions): Promise<Page<Record<string, unknown>>> { return this.repositories.pricing.history(userId, options); }
}
