import { z } from 'zod';

const uuid = z.string().uuid();
const currency = z.string().regex(/^[A-Z]{3}$/, 'Currency must be a three-letter uppercase code.');
const jsonObject = z.record(z.string(), z.unknown());

export const idParamsSchema = z.object({ id: uuid }).strict();
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const inventoryListSchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['owned', 'listed', 'sold', 'archived']).optional(),
  category_id: uuid.optional(),
  sort: z.enum(['created_at', 'updated_at', 'item_name', 'status', 'estimated_value']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
}).strict();

export const inventoryCreateSchema = z.object({
  identified_item_id: uuid.nullable().optional(),
  price_estimate_id: uuid.nullable().optional(),
  category_id: uuid.nullable().optional(),
  brand_id: uuid.nullable().optional(),
  item_name: z.string().trim().min(1).max(200),
  condition: z.string().trim().max(100).nullable().optional(),
  status: z.enum(['owned', 'listed', 'sold', 'archived']).default('owned'),
  purchase_price: z.number().nonnegative().nullable().optional(),
  purchase_currency: currency.nullable().optional(),
  estimated_value: z.number().nonnegative().nullable().optional(),
  estimated_value_currency: currency.nullable().optional(),
  listing_price: z.number().nonnegative().nullable().optional(),
  listing_currency: currency.nullable().optional(),
  attributes: jsonObject.default({}),
}).strict();

export const inventoryPatchSchema = inventoryCreateSchema.partial().strict();

export const salesListSchema = paginationSchema.extend({
  inventory_item_id: uuid.optional(),
  sort: z.enum(['sold_at', 'created_at', 'sale_price']).default('sold_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
}).strict();

export const salesCreateSchema = z.object({
  inventory_item_id: uuid,
  marketplace_id: uuid.nullable().optional(),
  sale_price: z.number().nonnegative(),
  sale_currency: currency,
  fee_amount: z.number().nonnegative().default(0),
  fee_currency: currency,
  net_earnings: z.number().nonnegative(),
  net_currency: currency,
  sold_at: z.string().datetime().optional(),
  attributes: jsonObject.default({}),
}).strict();

export const feeCalculationSchema = z.object({
  marketplace_id: uuid,
  sale_price: z.number().positive(),
  currency,
}).strict();

export const listingListSchema = paginationSchema.strict();
export const listingCreateSchema = z.object({
  inventory_item_id: uuid,
  marketplace_id: uuid.nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10000).nullable().optional(),
  condition: z.string().max(100).nullable().optional(),
  asking_price: z.number().nonnegative().nullable().optional(),
  asking_currency: currency.nullable().optional(),
  attributes: jsonObject.default({}),
  status: z.enum(['draft', 'ready', 'archived']).default('draft'),
}).strict();
export const listingPatchSchema = listingCreateSchema.omit({ inventory_item_id: true }).partial().strict();

export const itemPatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  model: z.string().max(200).nullable().optional(),
  category_id: uuid.nullable().optional(),
  brand_id: uuid.nullable().optional(),
  condition: z.string().max(100).nullable().optional(),
  key_attributes: jsonObject.optional(),
  review_status: z.enum(['needs_review', 'reviewed']).optional(),
}).strict();

export const stubRetrySchema = z.object({}).strict();
