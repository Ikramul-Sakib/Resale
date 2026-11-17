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
  ListingListOptions,
  PaginationOptions,
  EstimateRequestInput,
  PricingHistoryOptions,
  RecordSaleInput,
  Repositories,
  SalesListOptions,
} from '../repositories/contracts.js';
import type { AuthenticatedUser, InventoryItem, ListingDraft, Marketplace, Page, SalesRecord } from '../types/index.js';
import type { ScanUploadFile, ScanService } from './scans.js';
import type { PricingService } from './pricing/service.js';
import type { ListingService } from './listings.js';
import type { ListingGenerationResult } from './gemini/types.js';

export interface ListingGenerateInput {
  item_id: string;
  marketplace_id: string;
  currency: string;
  tone: 'concise' | 'detailed' | 'friendly' | 'neutral';
  notes?: string | null;
  asking_price?: number | null;
}

export interface ListingGenerateView {
  generated: ListingGenerationResult;
  item_id: string;
  inventory_item_id: string | null;
  marketplace: Marketplace;
  ai_mode: 'real' | 'mock';
  estimate_id: string | null;
  unsaved: true;
}

export interface Services {
  auth: {
    me(user: AuthenticatedUser): Promise<{ user: AuthenticatedUser; profile: Record<string, unknown> | null }>;
  };
  inventory: {
    list(userId: string, options: InventoryListOptions): Promise<Page<InventoryItem>>;
    create(userId: string, input: InventoryCreateInput): Promise<InventoryItem>;
    get(userId: string, id: string): Promise<InventoryItem>;
    update(userId: string, id: string, input: InventoryPatchInput): Promise<InventoryItem>;
    delete(userId: string, id: string): Promise<void>;
  };
  sales: {
    list(userId: string, options: SalesListOptions): Promise<Page<SalesRecord>>;
    record(userId: string, input: RecordSaleInput): Promise<SalesRecord>;
  };
  marketplaces: {
    list(): Promise<Marketplace[]>;
  };
  fees: {
    calculate(input: FeeCalculationInput): Promise<FeeCalculationResult>;
  };
  analytics: {
    dashboard(userId: string): Promise<AnalyticsDashboard>;
  };
  scans: {
    list(userId: string, options: PaginationOptions): Promise<Page<Record<string, unknown>>>;
    get(userId: string, id: string): Promise<Record<string, unknown>>;
    create(userId: string, files: ScanUploadFile[], source: 'upload' | 'camera'): Promise<Record<string, unknown>>;
    retry(userId: string, id: string): Promise<Record<string, unknown>>;
  };
  items: {
    get(userId: string, id: string): Promise<Record<string, unknown>>;
    update(userId: string, id: string, input: ItemPatchInput): Promise<Record<string, unknown>>;
  };
  listings: {
    generate(userId: string, input: ListingGenerateInput): Promise<ListingGenerateView>;
    list(userId: string, options: ListingListOptions): Promise<Page<ListingDraft>>;
    get(userId: string, id: string): Promise<ListingDraft>;
    create(userId: string, input: ListingCreateInput): Promise<ListingDraft>;
    update(userId: string, id: string, input: ListingPatchInput): Promise<ListingDraft>;
    delete(userId: string, id: string): Promise<void>;
  };
  pricing: {
    estimate(userId: string, itemId: string, input: EstimateRequestInput): ReturnType<PricingService['estimate']>;
    history(userId: string, options: PricingHistoryOptions): Promise<Page<Record<string, unknown>>>;
  };
  estimates: {
    get(userId: string, id: string): Promise<Record<string, unknown>>;
  };
}

export function createServices(repositories: Repositories, scanPipeline?: ScanService, pricingPipeline?: PricingService, listingPipeline?: ListingService): Services {
  const pricingEngine = pricingPipeline ?? ({ estimate: () => Promise.reject(new Error('Pricing pipeline is not configured.')), history: (userId: string, options: PricingHistoryOptions) => repositories.pricing.history(userId, options) } as unknown as PricingService);
  const listingEngine = listingPipeline ?? ({ generate: () => Promise.reject(new Error('Listing pipeline is not configured.')) } as unknown as ListingService);
  return {
    auth: {
      async me(user) {
        return { user, profile: await repositories.profiles.getByUserId(user.id) };
      },
    },
    inventory: {
      list: (userId, options) => repositories.inventory.list(userId, options),
      create: (userId, input) => repositories.inventory.create(userId, input),
      get: (userId, id) => repositories.inventory.getById(userId, id),
      update: (userId, id, input) => repositories.inventory.update(userId, id, input),
      delete: (userId, id) => repositories.inventory.delete(userId, id),
    },
    sales: {
      list: (userId, options) => repositories.sales.list(userId, options),
      record: (userId, input) => repositories.sales.record(userId, input),
    },
    marketplaces: { list: () => repositories.reference.listMarketplaces() },
    fees: { calculate: (input) => repositories.fees.calculate(input) },
    analytics: { dashboard: (userId) => repositories.analytics.dashboard(userId) },
    scans: {
      list: (userId, options) => scanPipeline ? scanPipeline.list(userId, options) : repositories.scans.list(userId, options),
      get: (userId, id) => scanPipeline ? scanPipeline.get(userId, id) : repositories.scans.getById(userId, id),
      create: (userId, files, source) => scanPipeline ? scanPipeline.create(userId, files, source) : Promise.reject(new Error('Scan pipeline is not configured.')),
      retry: (userId, id) => scanPipeline ? scanPipeline.retry(userId, id) : Promise.reject(new Error('Scan pipeline is not configured.')),
    },
    items: {
      get: (userId, id) => repositories.items.getById(userId, id),
      update: (userId, id, input) => repositories.items.update(userId, id, input),
    },
    listings: {
      generate: (userId, input) => listingEngine.generate(userId, input),
      list: (userId, options) => listingEngine.list(userId, options),
      get: (userId, id) => listingEngine.get(userId, id),
      create: (userId, input) => listingEngine.create(userId, input),
      update: (userId, id, input) => listingEngine.update(userId, id, input),
      delete: (userId, id) => listingEngine.delete(userId, id),
    },
    pricing: { estimate: (userId, itemId, input) => pricingEngine.estimate(userId, itemId, input), history: (userId, options) => pricingEngine.history(userId, options) },
    estimates: { get: (userId, id) => repositories.estimates.getById(userId, id) },
  };
}
