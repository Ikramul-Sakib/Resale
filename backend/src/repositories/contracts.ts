import type { FeeRule, InventoryItem, ListingDraft, Marketplace, Page, SalesRecord } from '../types/index.js';
import type { IdentificationResult, ImageInput } from '../services/gemini/types.js';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface InventoryListOptions extends PaginationOptions {
  search?: string;
  status?: InventoryItem['status'];
  category_id?: string;
  sort: 'created_at' | 'updated_at' | 'item_name' | 'status' | 'estimated_value';
  order: 'asc' | 'desc';
}

export type InventoryCreateInput = Omit<Partial<InventoryItem>, 'id' | 'user_id' | 'created_at' | 'updated_at'> & {
  item_name: string;
};

export type InventoryPatchInput = Partial<InventoryCreateInput>;

export interface SalesListOptions extends PaginationOptions {
  inventory_item_id?: string;
  sort: 'sold_at' | 'created_at' | 'sale_price';
  order: 'asc' | 'desc';
}

export interface RecordSaleInput {
  inventory_item_id: string;
  marketplace_id?: string | null;
  sale_price: number;
  sale_currency: string;
  fee_amount: number;
  fee_currency: string;
  net_earnings: number;
  net_currency: string;
  sold_at: string;
  attributes: Record<string, unknown>;
}

export interface FeeCalculationInput {
  marketplace_id: string;
  sale_price: number;
  currency: string;
  manual_percentage?: number;
}

export interface FeeCalculationResult {
  marketplace_id: string;
  sale_price: number;
  currency: string;
  fee_amount: number;
  status?: 'verified' | 'user_entered_unverified';
  rule: Omit<Pick<FeeRule, 'id' | 'name' | 'fee_type' | 'source' | 'verified_at' | 'percentage_rate' | 'fixed_amount' | 'currency'>, 'id'> & { id: string | null };
}

export interface EstimateCreateInput {
  identified_item_id: string;
  scan_id: string;
  low: number;
  typical: number;
  high: number;
  suggested_selling_price: number;
  currency: string;
  methodology: string;
  user_id?: never;
  suggested_price?: number;
  estimated_fee_amount?: number | null;
  estimated_net_earnings?: number | null;
  live_market_data_used: boolean;
  factors: Record<string, unknown>;
  data_source: string;
  model_id?: string | null;
  prompt_version: string;
  uncertainty_note?: string | null;
  explanation: string;
  marketplace_id?: string | null;
  purchase_price?: number | null;
  purchase_currency?: string | null;
  market_data_status: 'not_connected' | 'connected';
  fee_rule_status: 'verified' | 'not_verified' | 'user_entered_unverified';
}

export interface EstimateRequestInput {
  currency: string;
  purchase_price?: number | null;
  marketplace_id?: string | null;
  force?: boolean;
}

export interface PricingHistoryOptions extends PaginationOptions {
  item_id?: string;
}

export interface AnalyticsDashboard {
  inventory: {
    owned: number;
    listed: number;
    sold: number;
    archived: number;
    estimated_value: number;
  };
  sales: {
    count: number;
    net_earnings: number;
  };
}

export interface ItemPatchInput {
  name?: string;
  brand_text?: string | null;
  category_text?: string | null;
  product_type?: string | null;
  model?: string | null;
  category_id?: string | null;
  brand_id?: string | null;
  condition?: string | null;
  key_attributes?: Record<string, unknown>;
  identification_notes?: string | null;
  review_status?: 'needs_review' | 'reviewed';
}

export interface ScanImageRecord {
  id: string;
  scan_id: string;
  user_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  byte_size: number;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  signed_url?: string;
}

export interface ScanRecord {
  [key: string]: unknown;
  id: string;
  user_id: string;
  status: 'uploaded' | 'identifying' | 'identified' | 'estimating' | 'completed' | 'failed';
  source: 'upload' | 'camera' | 'demo';
  error_message?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  images?: ScanImageRecord[];
  identified_item?: Record<string, unknown> | null;
}

export interface ListingCreateInput {
  inventory_item_id?: string | null;
  identified_item_id?: string | null;
  marketplace_id?: string | null;
  title: string;
  description?: string | null;
  condition?: string | null;
  asking_price?: number | null;
  asking_currency?: string | null;
  attributes: Record<string, unknown>;
  status: 'draft' | 'ready' | 'archived';
}

export type ListingPatchInput = Partial<Omit<ListingCreateInput, 'inventory_item_id'>>;

export interface ListingListOptions extends PaginationOptions {
  item_id?: string;
  marketplace_id?: string;
  search?: string;
  include_archived?: boolean;
}

export interface Repositories {
  profiles: {
    getByUserId(userId: string): Promise<Record<string, unknown> | null>;
  };
  inventory: {
    list(userId: string, options: InventoryListOptions): Promise<Page<InventoryItem>>;
    create(userId: string, input: InventoryCreateInput): Promise<InventoryItem>;
    getById(userId: string, id: string): Promise<InventoryItem>;
    update(userId: string, id: string, input: InventoryPatchInput): Promise<InventoryItem>;
    delete(userId: string, id: string): Promise<void>;
  };
  sales: {
    list(userId: string, options: SalesListOptions): Promise<Page<SalesRecord>>;
    record(userId: string, input: RecordSaleInput): Promise<SalesRecord>;
  };
  reference: {
    listMarketplaces(): Promise<Marketplace[]>;
    getMarketplaceById(id: string): Promise<Marketplace>;
  };
  fees: {
    calculate(input: FeeCalculationInput): Promise<FeeCalculationResult>;
  };
  analytics: {
    dashboard(userId: string): Promise<AnalyticsDashboard>;
  };
  scans: {
    list(userId: string, options: PaginationOptions): Promise<Page<Record<string, unknown>>>;
    getById(userId: string, id: string): Promise<Record<string, unknown>>;
    create(userId: string, source: 'upload' | 'camera'): Promise<ScanRecord>;
    addImage(userId: string, input: Omit<ScanImageRecord, 'id' | 'created_at' | 'updated_at' | 'signed_url'>): Promise<ScanImageRecord>;
    getImages(userId: string, scanId: string): Promise<ScanImageRecord[]>;
    getImageBytes(userId: string, storagePath: string): Promise<ImageInput>;
    uploadStorage(storagePath: string, bytes: Buffer, mimeType: ScanImageRecord['mime_type']): Promise<void>;
    updateStatus(userId: string, scanId: string, status: ScanRecord['status'], errorMessage?: string | null): Promise<ScanRecord>;
    getIdentifiedItem(userId: string, scanId: string): Promise<Record<string, unknown> | null>;
    createIdentifiedItem(userId: string, scanId: string, result: IdentificationResult, mock: boolean): Promise<Record<string, unknown>>;
    updateIdentifiedItem(userId: string, itemId: string, input: ItemPatchInput): Promise<Record<string, unknown>>;
    signImage(storagePath: string): Promise<string>;
    deleteStorage(paths: string[]): Promise<void>;
    deleteScan(userId: string, scanId: string): Promise<void>;
  };
  items: {
    getById(userId: string, id: string): Promise<Record<string, unknown>>;
    update(userId: string, id: string, input: ItemPatchInput): Promise<Record<string, unknown>>;
  };
  listings: {
    list(userId: string, options: ListingListOptions): Promise<Page<ListingDraft>>;
    getById(userId: string, id: string): Promise<ListingDraft>;
    create(userId: string, input: ListingCreateInput): Promise<ListingDraft>;
    update(userId: string, id: string, input: ListingPatchInput): Promise<ListingDraft>;
    delete(userId: string, id: string): Promise<void>;
  };
  audit: {
    create(userId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>): Promise<void>;
  };
  pricing: {
    history(userId: string, options: PricingHistoryOptions): Promise<Page<Record<string, unknown>>>;
  };
  estimates: {
    create(userId: string, input: EstimateCreateInput): Promise<Record<string, unknown>>;
    findRecent(userId: string, itemId: string, currency: string, since: string): Promise<Record<string, unknown> | null>;
    findLatestForItem(userId: string, itemId: string, currency?: string): Promise<Record<string, unknown> | null>;
    getById(userId: string, id: string): Promise<Record<string, unknown>>;
  };
}
