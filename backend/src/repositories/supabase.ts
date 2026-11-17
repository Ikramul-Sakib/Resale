import type { SupabaseDatabaseClient } from '../config/supabase.js';
import type { FeeRule, InventoryItem, ListingDraft, Marketplace, Page, SalesRecord } from '../types/index.js';
import { AppError, isSupabaseNotFound, repositoryError } from '../utils/errors.js';
import { pageOffset, totalPages } from '../utils/pagination.js';
import type {
  AnalyticsDashboard,
  EstimateCreateInput,
  FeeCalculationInput,
  FeeCalculationResult,
  InventoryCreateInput,
  InventoryListOptions,
  InventoryPatchInput,
  ItemPatchInput,
  ListingCreateInput,
  ListingPatchInput,
  PaginationOptions,
  PricingHistoryOptions,
  ListingListOptions,
  RecordSaleInput,
  Repositories,
  ScanImageRecord,
  ScanRecord,
  SalesListOptions,
  ScanListOptions,
} from './contracts.js';
import type { IdentificationResult, ImageInput } from '../services/gemini/types.js';
import { cents, money, percentageOf } from '../utils/money.js';

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
    if (options.condition) query = query.ilike('condition', `%${escapeSearch(options.condition)}%`);
    if (options.category_id) query = query.eq('category_id', options.category_id);
    const { data, error, count } = await query
      .order(options.sort, { ascending: options.order === 'asc' })
      .range(pageOffset(options.page, options.limit), pageOffset(options.page, options.limit) + options.limit - 1);
    throwIfError(error);
    const rows = (data ?? []) as InventoryItem[];
    const decorated = await Promise.all(rows.map(async (row) => {
      if (!row.identified_item_id) return row;
      const { data: item } = await this.client.from('identified_items').select('scan_id').eq('id', row.identified_item_id).eq('user_id', userId).maybeSingle();
      if (!item?.scan_id) return row;
      const { data: image } = await this.client.from('scan_images').select('storage_path').eq('scan_id', item.scan_id).eq('user_id', userId).order('sort_order').limit(1).maybeSingle();
      if (!image?.storage_path) return row;
      const { data: signed } = await this.client.storage.from('product-images').createSignedUrl(image.storage_path, 3600);
      return { ...row, thumbnail_url: signed?.signedUrl ?? null };
    }));
    return page(decorated, count, options);
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
    if (options.date_from) query = query.gte('sold_at', options.date_from);
    if (options.date_to) query = query.lte('sold_at', options.date_to);
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

  async getMarketplaceById(id: string): Promise<Marketplace> {
    const { data, error } = await this.client.from('marketplaces').select('*').eq('id', id).eq('is_active', true).maybeSingle();
    throwIfError(error);
    return requireData(data as Marketplace | null, 'Marketplace');
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
    if (!rule && input.manual_percentage === undefined) throw new AppError(422, 'FEE_RULE_UNAVAILABLE', 'No verified fee rule is configured for this marketplace.');
    if (!rule && input.manual_percentage !== undefined) {
      const saleCents = cents(input.sale_price);
      const feeAmount = money(percentageOf(saleCents, input.manual_percentage));
      const payment = money(percentageOf(saleCents, input.payment_processing_percentage ?? 0));
      const purchase = money(cents(input.purchase_cost));
      const shipping = money(cents(input.shipping_cost));
      const total = cents(feeAmount) + cents(payment) + cents(purchase) + cents(shipping);
      return {
        marketplace_id: input.marketplace_id, sale_price: input.sale_price, currency: input.currency, fee_amount: feeAmount,
        payment_processing_fee: payment, purchase_cost: purchase, shipping_cost: shipping, total_expenses: money(total), net_earnings: money(saleCents - total), profit_margin: input.sale_price ? Number(((Number(saleCents - total) / Number(saleCents)) * 100).toFixed(2)) : null,
        status: 'user_entered_unverified',
        rule: { id: null, name: 'User-entered percentage (unverified)', fee_type: 'percentage', source: 'user_input', verified_at: null, percentage_rate: input.manual_percentage, fixed_amount: null, currency: input.currency },
      };
    }
    if (!rule) throw new AppError(422, 'FEE_RULE_UNAVAILABLE', 'No verified fee rule is configured for this marketplace.');
    if (rule.currency && rule.currency !== input.currency && rule.fee_type !== 'percentage') {
      throw new AppError(422, 'CURRENCY_MISMATCH', 'The configured fixed fee uses a different currency.');
    }
    const saleCents = cents(input.sale_price);
    const percentage = rule.percentage_rate ? percentageOf(saleCents, Number(rule.percentage_rate)) : 0n;
    const fixed = cents(rule.fixed_amount);
    const feeAmount = money(percentage + fixed);
    const payment = money(percentageOf(saleCents, input.payment_processing_percentage ?? 0));
    const purchase = money(cents(input.purchase_cost));
    const shipping = money(cents(input.shipping_cost));
    const total = percentage + fixed + cents(payment) + cents(purchase) + cents(shipping);
    return {
      marketplace_id: input.marketplace_id,
      sale_price: input.sale_price,
      currency: input.currency,
      fee_amount: feeAmount,
      payment_processing_fee: payment, purchase_cost: purchase, shipping_cost: shipping, total_expenses: money(total), net_earnings: money(saleCents - total), profit_margin: input.sale_price ? Number(((Number(saleCents - total) / Number(saleCents)) * 100).toFixed(2)) : null,
      status: 'verified',
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

  async dashboard(userId: string, options: { date_from?: string; date_to?: string } = {}): Promise<AnalyticsDashboard> {
    const [inventory, sales, activity] = await Promise.all([
      this.client.from('inventory_items').select('id, status, estimated_value, estimated_value_currency, category_id, item_name').eq('user_id', userId),
      (() => { let q = this.client.from('sales').select('*').eq('user_id', userId); if (options.date_from) q = q.gte('sold_at', options.date_from); if (options.date_to) q = q.lte('sold_at', options.date_to); return q; })(),
      this.client.from('audit_events').select('id,action,entity_type,entity_id,metadata,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
    ]);
    throwIfError(inventory.error);
    throwIfError(sales.error);
    throwIfError(activity.error);
    const inventoryRows = (inventory.data ?? []) as Array<{ id: string; status: InventoryItem['status']; estimated_value?: number | string | null; estimated_value_currency?: string | null; category_id?: string | null; item_name: string }>;
    const saleRows = (sales.data ?? []) as Array<{ inventory_item_id: string; sale_price: number | string; sale_currency: string; net_earnings: number | string; net_currency: string; sold_at: string; fee_amount: number | string }>;
    const count = (status: InventoryItem['status']) => inventoryRows.filter((row) => row.status === status).length;
    const byCurrency = (rows: Array<{ currency: string; value: number }>) => rows.reduce<Record<string, number>>((result, row) => { result[row.currency] = Number(((result[row.currency] ?? 0) + row.value).toFixed(2)); return result; }, {});
    const inventoryValueByCurrency = byCurrency(inventoryRows.filter((row) => row.estimated_value != null).map((row) => ({ currency: row.estimated_value_currency ?? 'USD', value: Number(row.estimated_value ?? 0) })));
    const revenueByCurrency = byCurrency(saleRows.map((row) => ({ currency: row.sale_currency, value: Number(row.sale_price) })));
    const profitByCurrency = byCurrency(saleRows.map((row) => ({ currency: row.net_currency, value: Number(row.net_earnings) })));
    const months = saleRows.reduce<Record<string, { revenue_by_currency: Record<string, number>; count: number }>>((result, row) => { const month = row.sold_at.slice(0, 7); const entry = result[month] ?? { revenue_by_currency: {}, count: 0 }; entry.count += 1; entry.revenue_by_currency[row.sale_currency] = Number(((entry.revenue_by_currency[row.sale_currency] ?? 0) + Number(row.sale_price)).toFixed(2)); result[month] = entry; return result; }, {});
    const categoryNames = new Map<string, string>();
    const categoryIds = [...new Set(inventoryRows.map((row) => row.category_id).filter(Boolean))] as string[];
    if (categoryIds.length) { const categories = await this.client.from('categories').select('id,name').in('id', categoryIds); for (const category of (categories.data ?? []) as Array<{ id: string; name: string }>) categoryNames.set(category.id, category.name); }
    const itemCategory = new Map(inventoryRows.map((row) => [row.id, row.category_id ? (categoryNames.get(row.category_id) ?? 'Uncategorized') : 'Uncategorized']));
    const categoryMap = saleRows.reduce<Record<string, { count: number; revenue_by_currency: Record<string, number> }>>((result, row) => { const category = itemCategory.get(row.inventory_item_id) ?? 'Uncategorized'; const entry = result[category] ?? { count: 0, revenue_by_currency: {} }; entry.count += 1; entry.revenue_by_currency[row.sale_currency] = Number(((entry.revenue_by_currency[row.sale_currency] ?? 0) + Number(row.sale_price)).toFixed(2)); result[category] = entry; return result; }, {});
    return {
      inventory: {
        owned: count('owned'),
        listed: count('listed'),
        sold: count('sold'),
        archived: count('archived'),
        estimated_value: Number(Object.values(inventoryValueByCurrency).reduce((sum, value) => sum + value, 0).toFixed(2)),
      },
      sales: {
        count: saleRows.length,
        net_earnings: Number(Object.values(profitByCurrency).reduce((sum, value) => sum + value, 0).toFixed(2)),
        revenue_by_currency: revenueByCurrency,
        profit_by_currency: profitByCurrency,
      },
      inventory_value_by_currency: inventoryValueByCurrency,
      monthly_sales: Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, ...value })),
      status_distribution: (['owned', 'listed', 'sold', 'archived'] as const).map((status) => ({ status, count: count(status) })),
      category_performance: Object.entries(categoryMap).map(([category, value]) => ({ category, ...value })),
      recent_sales: saleRows.slice().sort((a, b) => b.sold_at.localeCompare(a.sold_at)).slice(0, 10),
      activity: (activity.data ?? []) as Array<Record<string, unknown>>,
      date_from: options.date_from ?? null,
      date_to: options.date_to ?? null,
    };
  }
}

class ScanRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async list(userId: string, options: ScanListOptions): Promise<Page<Record<string, unknown>>> {
    let query = this.client.from('scans').select('*', { count: 'exact' }).eq('user_id', userId);
    if (options.status) query = query.eq('status', options.status);
    if (options.search) query = query.ilike('id', `%${escapeSearch(options.search)}%`);
    const { data, error, count } = await query
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

  async create(userId: string, source: 'upload' | 'camera'): Promise<ScanRecord> {
    const { data, error } = await this.client.from('scans').insert({ user_id: userId, source, status: 'uploaded' }).select('*').single();
    throwIfError(error);
    return requireData(data as ScanRecord | null, 'Scan');
  }

  async addImage(userId: string, input: Omit<ScanImageRecord, 'id' | 'created_at' | 'updated_at' | 'signed_url'>): Promise<ScanImageRecord> {
    const { data, error } = await this.client.from('scan_images').insert({ ...input, user_id: userId }).select('*').single();
    throwIfError(error);
    return requireData(data as ScanImageRecord | null, 'Scan image');
  }

  async getImages(userId: string, scanId: string): Promise<ScanImageRecord[]> {
    const { data, error } = await this.client.from('scan_images').select('*').eq('scan_id', scanId).eq('user_id', userId).order('sort_order', { ascending: true });
    throwIfError(error);
    return (data ?? []) as ScanImageRecord[];
  }

  async getImageBytes(userId: string, storagePath: string): Promise<ImageInput> {
    const { data: image, error } = await this.client.from('scan_images').select('mime_type').eq('user_id', userId).eq('storage_path', storagePath).maybeSingle();
    throwIfError(error);
    const record = requireData(image as { mime_type: ImageInput['mimeType'] } | null, 'Scan image');
    const { data, error: storageError } = await this.client.storage.from('product-images').download(storagePath);
    if (storageError || !data) throw new AppError(502, 'IMAGE_DOWNLOAD_FAILED', 'The uploaded image could not be read.');
    return { bytes: Buffer.from(await data.arrayBuffer()), mimeType: record.mime_type };
  }

  async uploadStorage(storagePath: string, bytes: Buffer, mimeType: ScanImageRecord['mime_type']): Promise<void> {
    const { error } = await this.client.storage.from('product-images').upload(storagePath, bytes, { contentType: mimeType, upsert: false });
    if (error) throw new AppError(502, 'IMAGE_UPLOAD_FAILED', 'The image could not be stored securely.');
  }

  async updateStatus(userId: string, scanId: string, status: ScanRecord['status'], errorMessage: string | null = null): Promise<ScanRecord> {
    const { data, error } = await this.client.from('scans').update({ status, error_message: errorMessage }).eq('id', scanId).eq('user_id', userId).select('*').single();
    throwIfError(error);
    return requireData(data as ScanRecord | null, 'Scan');
  }

  async getIdentifiedItem(userId: string, scanId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.client.from('identified_items').select('*').eq('scan_id', scanId).eq('user_id', userId).maybeSingle();
    throwIfError(error);
    return data as Record<string, unknown> | null;
  }

  async createIdentifiedItem(userId: string, scanId: string, result: IdentificationResult, mock: boolean): Promise<Record<string, unknown>> {
    const { data, error } = await this.client.from('identified_items').insert({
      user_id: userId,
      scan_id: scanId,
      name: result.product_name ?? 'Unknown item',
      brand_text: result.brand,
      model: result.model,
      category_text: result.category,
      product_type: result.product_type,
      condition: result.visible_condition,
      key_attributes: result.key_attributes,
      confidence_score: result.confidence,
      identification_notes: result.identification_notes,
      identification_source: mock ? 'mock' : 'gemini',
    }).select('*').single();
    throwIfError(error);
    return requireData(data as Record<string, unknown> | null, 'Identified item');
  }

  async updateIdentifiedItem(userId: string, itemId: string, input: ItemPatchInput): Promise<Record<string, unknown>> {
    const { data, error } = await this.client.from('identified_items').update(input).eq('id', itemId).eq('user_id', userId).select('*').maybeSingle();
    throwIfError(error);
    return requireData(data as Record<string, unknown> | null, 'Identified item');
  }

  async signImage(storagePath: string): Promise<string> {
    const { data, error } = await this.client.storage.from('product-images').createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) throw new AppError(502, 'IMAGE_URL_FAILED', 'A signed image URL could not be created.');
    return data.signedUrl;
  }

  async deleteStorage(paths: string[]): Promise<void> {
    if (!paths.length) return;
    const { error } = await this.client.storage.from('product-images').remove(paths);
    if (error) throw new AppError(502, 'IMAGE_CLEANUP_FAILED', 'Uploaded image cleanup failed.');
  }

  async deleteScan(userId: string, scanId: string): Promise<void> {
    const { error } = await this.client.from('scans').delete().eq('id', scanId).eq('user_id', userId);
    throwIfError(error);
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

  async list(userId: string, options: ListingListOptions): Promise<Page<ListingDraft>> {
    let query = this.client.from('listing_drafts').select('*', { count: 'exact' }).eq('user_id', userId);
    if (!options.include_archived) query = query.neq('status', 'archived');
    if (options.marketplace_id) query = query.eq('marketplace_id', options.marketplace_id);
    if (options.item_id) query = query.or(`inventory_item_id.eq.${options.item_id},identified_item_id.eq.${options.item_id}`);
    if (options.search) {
      const search = escapeSearch(options.search);
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(pageOffset(options.page, options.limit), pageOffset(options.page, options.limit) + options.limit - 1);
    throwIfError(error);
    return page(data as ListingDraft[] | null, count, options);
  }

  async getById(userId: string, id: string): Promise<ListingDraft> {
    const { data, error } = await this.client.from('listing_drafts').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    throwIfError(error);
    return requireData(data as ListingDraft | null, 'Listing draft');
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
    const { data, error } = await this.client.from('listing_drafts').update({ status: 'archived' }).eq('id', id).eq('user_id', userId).select('id').maybeSingle();
    throwIfError(error);
    requireData(data as { id: string } | null, 'Listing draft');
  }
}

class PricingRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async history(userId: string, options: PricingHistoryOptions): Promise<Page<Record<string, unknown>>> {
    let query = this.client.from('price_estimates').select('*', { count: 'exact' }).eq('user_id', userId);
    if (options.item_id) query = query.eq('identified_item_id', options.item_id);
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(pageOffset(options.page, options.limit), pageOffset(options.page, options.limit) + options.limit - 1);
    throwIfError(error);
    return page(data as Record<string, unknown>[] | null, count, options);
  }
}

class EstimateRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async create(userId: string, input: EstimateCreateInput): Promise<Record<string, unknown>> {
    const { suggested_selling_price, ...persisted } = input;
    const { data, error } = await this.client.from('price_estimates').insert({ ...persisted, user_id: userId, suggested_price: suggested_selling_price, source: persisted.data_source }).select('*').single();
    throwIfError(error);
    return requireData(data as Record<string, unknown> | null, 'Estimate');
  }

  async findRecent(userId: string, itemId: string, currency: string, since: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.client.from('price_estimates').select('*').eq('user_id', userId).eq('identified_item_id', itemId).eq('currency', currency).gte('created_at', since).order('created_at', { ascending: false }).limit(1).maybeSingle();
    throwIfError(error);
    return data as Record<string, unknown> | null;
  }

  async findLatestForItem(userId: string, itemId: string, currency?: string): Promise<Record<string, unknown> | null> {
    let query = this.client.from('price_estimates').select('*').eq('user_id', userId).eq('identified_item_id', itemId);
    if (currency) query = query.eq('currency', currency);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
    throwIfError(error);
    return data as Record<string, unknown> | null;
  }

  async getById(userId: string, id: string): Promise<Record<string, unknown>> {
    const { data, error } = await this.client.from('price_estimates').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    throwIfError(error);
    return requireData(data as Record<string, unknown> | null, 'Estimate');
  }
}

class AuditRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async create(userId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>): Promise<void> {
    const { error } = await this.client.from('audit_events').insert({ user_id: userId, action, entity_type: entityType, entity_id: entityId, metadata });
    throwIfError(error);
  }

  async recent(userId: string, limit: number): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.client.from('audit_events').select('id,action,entity_type,entity_id,metadata,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    throwIfError(error);
    return (data ?? []) as Array<Record<string, unknown>>;
  }
}

class PriceGuideRepository {
  constructor(private readonly client: SupabaseDatabaseClient) {}

  async list(userId: string, options: { page: number; limit: number; category_id?: string }): Promise<Page<Record<string, unknown>>> {
    let categoryQuery = this.client.from('categories').select('id,name,slug', { count: 'exact' }).order('name');
    if (options.category_id) categoryQuery = categoryQuery.eq('id', options.category_id);
    const categories = await categoryQuery.range(pageOffset(options.page, options.limit), pageOffset(options.page, options.limit) + options.limit - 1);
    throwIfError(categories.error);
    const rows = await Promise.all(((categories.data ?? []) as Array<{ id: string; name: string; slug: string }>).map(async (category) => {
      const identified = await this.client.from('identified_items').select('id,name,category_id,category_text').eq('user_id', userId).or(`category_id.eq.${category.id},category_text.ilike.%${escapeSearch(category.name)}%`);
      throwIfError(identified.error);
      const itemIds = ((identified.data ?? []) as Array<{ id: string }>).map((item) => item.id);
      const estimates = itemIds.length ? await this.client.from('price_estimates').select('id,low,typical,high,suggested_price,currency,data_source,created_at,updated_at,identified_item_id').eq('user_id', userId).in('identified_item_id', itemIds).order('created_at', { ascending: false }) : { data: [], error: null };
      throwIfError(estimates.error);
      const sales = itemIds.length ? await this.client.from('sales').select('id,inventory_item_id,sale_price,sale_currency,net_earnings,net_currency,sold_at').eq('user_id', userId).in('inventory_item_id', itemIds).order('sold_at', { ascending: false }) : { data: [], error: null };
      throwIfError(sales.error);
      const observations = itemIds.length ? await this.client.from('market_price_observations').select('*').eq('user_id', userId).in('identified_item_id', itemIds).order('observed_at', { ascending: false }).limit(50) : { data: [], error: null };
      throwIfError(observations.error);
      return { ...category, estimates: estimates.data ?? [], sales: sales.data ?? [], observations: observations.data ?? [], market_data_status: observations.data?.length ? 'connected' : 'not_connected' };
    }));
    return page(rows, categories.count, options);
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
    audit: new AuditRepository(client),
    pricing: new PricingRepository(client),
    estimates: new EstimateRepository(client),
    priceGuides: new PriceGuideRepository(client),
  };
}
