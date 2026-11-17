export interface ImageInput {
  bytes: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface IdentificationResult {
  product_name: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  product_type: string | null;
  visible_condition: string | null;
  key_attributes: Record<string, unknown>;
  confidence: number | null;
  identification_notes: string | null;
}

export interface ConfirmedPricingItem {
  brand: string | null;
  model: string | null;
  category: string | null;
  productType: string | null;
  age: string | null;
  condition: string | null;
  visibleDamageOrWear: string | null;
  originalPackaging: string | null;
  accessories: string | null;
  keyAttributes: Record<string, unknown>;
  purchasePrice: number | null;
  currency: string;
}

export interface PriceFactor {
  label: string;
  impact_type: 'percentage' | 'amount';
  impact: number;
}

export interface PriceEstimateResult {
  low: number;
  typical: number;
  high: number;
  suggested_selling_price: number;
  currency: string;
  explanation: string;
  factors: PriceFactor[];
  methodology: string;
  data_source: string;
  uncertainty_note: string | null;
}

export interface GeminiAdapter {
  readonly mode: 'real' | 'mock';
  identifyProduct(images: ImageInput[]): Promise<IdentificationResult>;
  estimatePrice(item: ConfirmedPricingItem): Promise<PriceEstimateResult>;
  extractAttributes(images: ImageInput[], productName?: string | null): Promise<Record<string, unknown>>;
}

export interface GeminiService {
  readonly mode: 'real' | 'mock';
  identifyProduct(images: ImageInput[]): Promise<IdentificationResult>;
  extractAttributes(images: ImageInput[], productName?: string | null): Promise<Record<string, unknown>>;
  /** Reserved for Phase 7. */
  estimatePrice(item: ConfirmedPricingItem): Promise<PriceEstimateResult>;
  /** Reserved for Phase 8. */
  generateListing: undefined;
}
