import type { ConfirmedPricingItem } from '../gemini/types.js';

export interface MarketDataObservation {
  source: string;
  price: number;
  currency: string;
}

export interface MarketDataProvider {
  readonly status: 'not_connected' | 'connected';
  getObservations(item: ConfirmedPricingItem): Promise<MarketDataObservation[]>;
}

export class NotConfiguredMarketDataProvider implements MarketDataProvider {
  readonly status = 'not_connected' as const;
  async getObservations(_item: ConfirmedPricingItem): Promise<MarketDataObservation[]> { return []; }
}
