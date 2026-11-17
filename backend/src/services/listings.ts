import type { ListingCreateInput, ListingListOptions, ListingPatchInput, Repositories } from '../repositories/contracts.js';
import type { ListingDraft, Page } from '../types/index.js';
import { AppError } from '../utils/errors.js';
import type { ConfirmedListingItem, GeminiService } from './gemini/types.js';
import type { ListingGenerateInput, ListingGenerateView } from './contracts.js';

function clean(value: unknown, max = 600): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = [...value].filter((character) => { const code = character.charCodeAt(0); return code >= 32 && code !== 127; }).join('').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function numeric(value: unknown): number | null {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export class ListingService {
  private readonly recentGenerations = new Map<string, number>();

  constructor(private readonly repositories: Repositories, private readonly gemini: GeminiService) {}

  async generate(userId: string, input: ListingGenerateInput): Promise<ListingGenerateView> {
    const key = `${userId}:${input.item_id}:${input.marketplace_id}`;
    const last = this.recentGenerations.get(key) ?? 0;
    if (Date.now() - last < 10_000) throw new AppError(429, 'GENERATION_TOO_FREQUENT', 'Please wait a few seconds before generating another listing draft.');
    this.recentGenerations.set(key, Date.now());
    try {
      const marketplace = await this.repositories.reference.getMarketplaceById(input.marketplace_id);
      let inventoryId: string | null = null;
      let itemId = input.item_id;
      let item: Record<string, unknown>;
      let estimate: Record<string, unknown> | null = null;
      try {
        const inventory = await this.repositories.inventory.getById(userId, input.item_id);
        inventoryId = inventory.id;
        if (!inventory.identified_item_id) throw new AppError(422, 'ITEM_DATA_REQUIRED', 'This inventory item has no confirmed product details.');
        itemId = inventory.identified_item_id;
        item = await this.repositories.items.getById(userId, itemId);
        estimate = inventory.price_estimate_id ? await this.repositories.estimates.getById(userId, inventory.price_estimate_id) : await this.repositories.estimates.findLatestForItem(userId, itemId);
      } catch (error) {
        if (!(error instanceof AppError) || error.statusCode !== 404) throw error;
        item = await this.repositories.items.getById(userId, input.item_id);
        estimate = await this.repositories.estimates.findLatestForItem(userId, input.item_id);
      }
      if (item.review_status !== 'reviewed') throw new AppError(409, 'ITEM_REVIEW_REQUIRED', 'Confirm the item details before generating a listing.');
      const estimatePrice = estimate ? numeric(estimate.suggested_price ?? estimate.suggested_selling_price) : null;
      const price = input.asking_price ?? estimatePrice;
      if (price === null) throw new AppError(422, 'ESTIMATE_REQUIRED', 'Run a price estimate first or enter a selling price manually.');
      const currency = clean(estimate?.currency, 3)?.toUpperCase() ?? input.currency;
      if (estimate && currency !== input.currency) throw new AppError(400, 'CURRENCY_MISMATCH', 'The listing currency must match the selected price estimate currency.');
      const attrs = item.key_attributes && typeof item.key_attributes === 'object' ? item.key_attributes as Record<string, unknown> : {};
      const safeAttributes = Object.fromEntries(Object.entries(attrs).slice(0, 30).map(([key, value]) => [clean(key, 80) ?? 'attribute', typeof value === 'string' ? clean(value, 300) : value]));
      const confirmed: ConfirmedListingItem = {
        name: clean(item.name, 300) ?? 'Product', brand: clean(item.brand_text, 200), model: clean(item.model, 200), category: clean(item.category_text, 200),
        productType: clean(item.product_type, 200), condition: clean(item.condition, 500), keyAttributes: safeAttributes,
        suggestedPrice: price, currency, targetMarketplace: marketplace.name, titleMaxLength: marketplace.title_max_length ?? 120,
        tone: input.tone, extraNotes: clean(input.notes, 1000),
      };
      const generated = await this.gemini.generateListing(confirmed);
      return { generated, item_id: itemId, inventory_item_id: inventoryId, marketplace, ai_mode: this.gemini.mode, estimate_id: estimate ? String(estimate.id) : null, unsaved: true };
    } catch (error) {
      this.recentGenerations.delete(key);
      throw error;
    }
  }

  list(userId: string, options: ListingListOptions): Promise<Page<ListingDraft>> { return this.repositories.listings.list(userId, options); }
  get(userId: string, id: string): Promise<ListingDraft> { return this.repositories.listings.getById(userId, id); }

  async create(userId: string, input: ListingCreateInput): Promise<ListingDraft> {
    if (input.marketplace_id) {
      const marketplace = await this.repositories.reference.getMarketplaceById(input.marketplace_id);
      if (input.title.length > (marketplace.title_max_length ?? 120)) throw new AppError(400, 'TITLE_TOO_LONG', `The title must be ${marketplace.title_max_length ?? 120} characters or fewer for this marketplace.`);
    }
    const draft = await this.repositories.listings.create(userId, input);
    await this.repositories.audit.create(userId, 'listing_draft_created', 'listing_draft', draft.id, { marketplace_id: input.marketplace_id ?? null, identified_item_id: input.identified_item_id ?? null, inventory_item_id: input.inventory_item_id ?? null });
    return draft;
  }

  async update(userId: string, id: string, input: ListingPatchInput): Promise<ListingDraft> {
    if (input.title) {
      const current = await this.repositories.listings.getById(userId, id);
      const marketplaceId = input.marketplace_id ?? current.marketplace_id;
      if (marketplaceId) {
        const marketplace = await this.repositories.reference.getMarketplaceById(marketplaceId);
      if (input.title.length > (marketplace.title_max_length ?? 120)) throw new AppError(400, 'TITLE_TOO_LONG', `The title must be ${marketplace.title_max_length ?? 120} characters or fewer for this marketplace.`);
      }
    }
    return this.repositories.listings.update(userId, id, input);
  }
  delete(userId: string, id: string): Promise<void> { return this.repositories.listings.delete(userId, id); }
}
