import type { SupabaseDatabaseClient } from '../config/supabase.js';
import type { FeeRule, InventoryItem, ListingDraft, Marketplace, Page, SalesRecord } from '../types/index.js';
import { AppError, isSupabaseNotFound, repositoryError } from '../utils/errors.js';
import { pageOffset, totalPages } from '../utils/pagination.js';
import type {
  AnalyticsDashboard,
  FeeCalculationInput,
  FeeCalculationResult,
  InventoryCreateInput,
  InventoryListOptions,
  InventoryPatchInput,
  ItemPatchInput,
  ListingCreateInput,
  ListingPatchInput,
  PaginationOptions,
  RecordSaleInput,
  Repositories,
  SalesListOptions,
} from './contracts.js';

function throwIfError(error: { message?: string; code?: string } | null): void {
  if (error) throw repositoryError(error);
}

function requireData<T>(data: T | null, entity: string): T {
  if (data === null) throw new AppError(404, 'NOT_FOUND', `${entity} was not found.`);
  return data;
}

function page<T>(data: T[] | null, count: number | null, options: PaginationOptions): Page<T> {
  const total = count ?? 0;
  return {
    data: data ?? [],
    page: options.page,
    limit: options.limit,
    total,
    total_pages: totalPages(total, options.limit),
  };
}

function escapeSearch(value: string): string {
  return value.replace(/[,%()]/g, ' ').trim();
}

class ProfileRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async getByUserId(userId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.client.from('profiles').select('*').eq('id', userId).maybeSingle();
    throwIfError(error);
    return data as Record<string, unknown> | null;
  }
}

class InventoryRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async list(userId: string, options: InventoryListOptions): Promise<Page<InventoryItem>> {
    let query = this.client.from('inventory_items').select('*', { count: 'exact' }).eq('user_id', userId);
    if (options.search) {
      const search = escapeSearch(options.search);
      query = query.or(`item_name.ilike.%${search}%,condition.ilike.%${search}%`);
    }
    if (options.status) query = query.eq('status', options.status);
    if (options.category_id) query = query.eq('category_id', options.category_id);
    const { data, error, count } = await query
      .order(options.sort, { ascending: options.order === 'asc' })
      .range(pageOffset(options.page, options.limit), pageOffset(options.page, options.limit) + options.limit - 1);
    throwIfError(error);
    return page(data as InventoryItem[] | null, count, options);
  }

  async create(userId: string, input: InventoryCreateInput): Promise<InventoryItem> {
    const { data, error } = await this.client.from('inventory_items').insert({ ...input, user_id: userId }).select('*').single();
    throwIfError(error);
    return requireData(data as InventoryItem | null, 'Inventory item');
  }

  async getById(userId: string, id: string): Promise<InventoryItem> {
    const { data, error } = await this.client.from('inventory_items').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    if (isSupabaseNotFound(error)) throw new AppError(404, 'NOT_FOUND', 'Inventory item was not found.');
    throwIfError(error);
    return requireData(data as InventoryItem | null, 'Inventory item');
  }

  async update(userId: string, id: string, input: InventoryPatchInput): Promise<InventoryItem> {
    const { data, error } = await this.client.from('inventory_items').update(input).eq('id', id).eq('user_id', userId).select('*').maybeSingle();
    throwIfError(error);
    return requireData(data as InventoryItem | null, 'Inventory item');
  }

  async delete(userId: string, id: string): Promise<void> {
    const { data, error } = await this.client.from('inventory_items').delete().eq('id', id).eq('user_id', userId).select('id').maybeSingle();
    throwIfError(error);
    requireData(data as { id: string } | null, 'Inventory item');
  }
}

class SalesRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async list(userId: string, options: SalesListOptions): Promise<Page<SalesRecord>> {
    let query = this.client.from('sales').select('*', { count: 'exact' }).eq('user_id', userId);
    if (options.inventory_item_id) query = query.eq('inventory_item_id', options.inventory_item_id);
    const { data, error, count } = await query
      .order(options.sort, { ascending: options.order === 'asc' })
      .range(pageOffset(options.page, options.limit), pageOffset(options.page, options.limit) + options.limit - 1);
    throwIfError(error);
    return page(data as SalesRecord[] | null, count, options);
  }

  async record(userId: string, input: RecordSaleInput): Promise<SalesRecord> {
    const { data, error } = await this.client.rpc('record_sale', {
      p_user_id: userId,
      p_inventory_item_id: input.inventory_item_id,
      p_marketplace_id: input.marketplace_id ?? null,
      p_sale_price: input.sale_price,
      p_sale_currency: input.sale_currency,
      p_fee_amount: input.fee_amount,
      p_fee_currency: input.fee_currency,
      p_net_earnings: input.net_earnings,
      p_net_currency: input.net_currency,
      p_sold_at: input.sold_at,
      p_attributes: input.attributes,
    }).single();
    throwIfError(error);
    return requireData(data as SalesRecord | null, 'Sale');
  }
}

class ReferenceRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async listMarketplaces(): Promise<Marketplace[]> {
    const { data, error } = await this.client.from('marketplaces').select('*').eq('is_active', true).order('name');
    throwIfError(error);
    return (data ?? []) as Marketplace[];
  }
}

class FeeRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async calculate(input: FeeCalculationInput): Promise<FeeCalculationResult> {
    const { data, error } = await this.client.from('marketplace_fee_rules')
      .select('id, marketplace_id, name, fee_type, percentage_rate, fixed_amount, currency, source, verified_at, is_placeholder')
      .eq('marketplace_id', input.marketplace_id)
      .eq('is_placeholder', false)
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfError(error);
    const rule = data as FeeRule | null;
    if (!rule) throw new AppError(422, 'FEE_RULE_UNAVAILABLE', 'No verified fee rule is configured for this marketplace.');
    if (rule.currency && rule.currency !== input.currency && rule.fee_type !== 'percentage') {
      throw new AppError(422, 'CURRENCY_MISMATCH', 'The configured fixed fee uses a different currency.');
    }
    const percentage = rule.percentage_rate ? input.sale_price * (Number(rule.percentage_rate) / 100) : 0;
    const fixed = rule.fixed_amount ? Number(rule.fixed_amount) : 0;
    const feeAmount = Math.round((percentage + fixed) * 100) / 100;
    return {
      marketplace_id: input.marketplace_id,
      sale_price: input.sale_price,
      currency: input.currency,
      fee_amount: feeAmount,
      rule: {
        id: rule.id,
        name: rule.name,
        fee_type: rule.fee_type,
        source: rule.source,
        verified_at: rule.verified_at,
        percentage_rate: rule.percentage_rate,
        fixed_amount: rule.fixed_amount,
        currency: rule.currency,
      },
    };
  }
}

class AnalyticsRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async dashboard(userId: string): Promise<AnalyticsDashboard> {
    const [inventory, sales] = await Promise.all([
      this.client.from('inventory_items').select('status, estimated_value').eq('user_id', userId),
      this.client.from('sales').select('net_earnings').eq('user_id', userId),
    ]);
    throwIfError(inventory.error);
    throwIfError(sales.error);
    const inventoryRows = (inventory.data ?? []) as Array<{ status: InventoryItem['status']; estimated_value?: number | string | null }>;
    const saleRows = (sales.data ?? []) as Array<{ net_earnings: number | string }>;
    const count = (status: InventoryItem['status']) => inventoryRows.filter((row) => row.status === status).length;
    return {
      inventory: {
        owned: count('owned'),
        listed: count('listed'),
        sold: count('sold'),
        archived: count('archived'),
        estimated_value: inventoryRows.reduce((sum, row) => sum + Number(row.estimated_value ?? 0), 0),
      },
      sales: {
        count: saleRows.length,
        net_earnings: saleRows.reduce((sum, row) => sum + Number(row.net_earnings), 0),
      },
    };
  }
}

class ScanRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async list(userId: string, options: PaginationOptions): Promise<Page<Record<string, unknown>>> {
    const { data, error, count } = await this.client.from('scans').select('*', { count: 'exact' }).eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(pageOffset(options.page, options.limit), pageOffset(options.page, options.limit) + options.limit - 1);
    throwIfError(error);
    return page(data as Record<string, unknown>[] | null, count, options);
  }

  async getById(userId: string, id: string): Promise<Record<string, unknown>> {
    const { data, error } = await this.client.from('scans').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    throwIfError(error);
    return requireData(data as Record<string, unknown> | null, 'Scan');
  }
}

class ItemRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async getById(userId: string, id: string): Promise<Record<string, unknown>> {
    const { data, error } = await this.client.from('identified_items').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    throwIfError(error);
    return requireData(data as Record<string, unknown> | null, 'Item');
  }

  async update(userId: string, id: string, input: ItemPatchInput): Promise<Record<string, unknown>> {
    const { data, error } = await this.client.from('identified_items').update(input).eq('id', id).eq('user_id', userId).select('*').maybeSingle();
    throwIfError(error);
    return requireData(data as Record<string, unknown> | null, 'Item');
  }
}

class ListingRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async list(userId: string, options: PaginationOptions): Promise<Page<ListingDraft>> {
    const { data, error, count } = await this.client.from('listing_drafts').select('*', { count: 'exact' }).eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(pageOffset(options.page, options.limit), pageOffset(options.page, options.limit) + options.limit - 1);
    throwIfError(error);
    return page(data as ListingDraft[] | null, count, options);
  }

  async create(userId: string, input: ListingCreateInput): Promise<ListingDraft> {
    const { data, error } = await this.client.from('listing_drafts').insert({ ...input, user_id: userId }).select('*').single();
    throwIfError(error);
    return requireData(data as ListingDraft | null, 'Listing draft');
  }

  async update(userId: string, id: string, input: ListingPatchInput): Promise<ListingDraft> {
    const { data, error } = await this.client.from('listing_drafts').update(input).eq('id', id).eq('user_id', userId).select('*').maybeSingle();
    throwIfError(error);
    return requireData(data as ListingDraft | null, 'Listing draft');
  }

  async delete(userId: string, id: string): Promise<void> {
    const { data, error } = await this.client.from('listing_drafts').delete().eq('id', id).eq('user_id', userId).select('id').maybeSingle();
    throwIfError(error);
    requireData(data as { id: string } | null, 'Listing draft');
  }
}

class PricingRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async history(userId: string, options: PaginationOptions): Promise<Page<Record<string, unknown>>> {
    const { data, error, count } = await this.client.from('price_estimates').select('*', { count: 'exact' }).eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(pageOffset(options.page, options.limit), pageOffset(options.page, options.limit) + options.limit - 1);
    throwIfError(error);
    return page(data as Record<string, unknown>[] | null, count, options);
  }
}

class EstimateRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async getById(userId: string, id: string): Promise<Record<string, unknown>> {
    const { data, error } = await this.client.from('price_estimates').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    throwIfError(error);
    return requireData(data as Record<string, unknown> | null, 'Estimate');
  }
}

export function createRepositories(client: SupabaseDatabaseClient): Repositories {
  return {
    profiles: new ProfileRepository(client),
    inventory: new InventoryRepository(client),
    sales: new SalesRepository(client),
    reference: new ReferenceRepository(client),
    fees: new FeeRepository(client),
    analytics: new AnalyticsRepository(client),
    scans: new ScanRepository(client),
    items: new ItemRepository(client),
    listings: new ListingRepository(client),
    pricing: new PricingRepository(client),
    estimates: new EstimateRepository(client),
  };
}
