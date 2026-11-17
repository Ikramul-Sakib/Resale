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
} from '../repositories/contracts.js';
import type { AuthenticatedUser, InventoryItem, ListingDraft, Marketplace, Page, SalesRecord } from '../types/index.js';

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
  };
  items: {
    get(userId: string, id: string): Promise<Record<string, unknown>>;
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
    get(userId: string, id: string): Promise<Record<string, unknown>>;
  };
}

export function createServices(repositories: Repositories): Services {
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
      list: (userId, options) => repositories.scans.list(userId, options),
      get: (userId, id) => repositories.scans.getById(userId, id),
    },
    items: {
      get: (userId, id) => repositories.items.getById(userId, id),
      update: (userId, id, input) => repositories.items.update(userId, id, input),
    },
    listings: {
      list: (userId, options) => repositories.listings.list(userId, options),
      create: (userId, input) => repositories.listings.create(userId, input),
      update: (userId, id, input) => repositories.listings.update(userId, id, input),
      delete: (userId, id) => repositories.listings.delete(userId, id),
    },
    pricing: { history: (userId, options) => repositories.pricing.history(userId, options) },
    estimates: { get: (userId, id) => repositories.estimates.getById(userId, id) },
  };
}
