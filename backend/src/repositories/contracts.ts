import type { FeeRule, InventoryItem, ListingDraft, Marketplace, Page, SalesRecord } from '../types/index.js';

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
}

export interface FeeCalculationResult {
  marketplace_id: string;
  sale_price: number;
  currency: string;
  fee_amount: number;
  rule: Pick<FeeRule, 'id' | 'name' | 'fee_type' | 'source' | 'verified_at' | 'percentage_rate' | 'fixed_amount' | 'currency'>;
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
  model?: string | null;
  category_id?: string | null;
  brand_id?: string | null;
  condition?: string | null;
  key_attributes?: Record<string, unknown>;
  review_status?: 'needs_review' | 'reviewed';
}

export interface ListingCreateInput {
  inventory_item_id: string;
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
  };
  items: {
    getById(userId: string, id: string): Promise<Record<string, unknown>>;
    update(userId: string, id: string, input: ItemPatchInput): Promise<Record<string, unknown>>;
  };
  listings: {
    list(userId: string, options: PaginationOptions): Promise<Page<ListingDraft>>;
    create(userId: string, input: ListingCreateInput): Promise<ListingDraft>;
    update(userId: string, id: string, input: ListingPatchInput): Promise<ListingDraft>;
    delete(userId: string, id: string): Promise<void>;
  };
  pricing: {
    history(userId: string, options: PaginationOptions): Promise<Page<Record<string, unknown>>>;
  };
  estimates: {
    getById(userId: string, id: string): Promise<Record<string, unknown>>;
  };
}
