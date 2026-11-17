import { z } from 'zod';
import { GeminiServiceError } from './errors.js';
import type { IdentificationResult } from './types.js';
import type { PriceEstimateResult } from './types.js';
import type { ListingGenerationResult } from './types.js';

const nullableText = z.string().trim().max(4000).nullable().optional().default(null);

export const identificationSchema = z.object({
  product_name: nullableText,
  brand: z.string().trim().max(200).nullable().optional().default(null),
  model: z.string().trim().max(200).nullable().optional().default(null),
  category: z.string().trim().max(200).nullable().optional().default(null),
  product_type: z.string().trim().max(200).nullable().optional().default(null),
  visible_condition: z.string().trim().max(400).nullable().optional().default(null),
  key_attributes: z.record(z.string(), z.unknown()).optional().default({}),
  confidence: z.number().min(0).max(1).nullable().optional().default(null),
  identification_notes: nullableText,
}).strict();

export const identificationJsonSchema = {
  type: 'object',
  properties: {
    product_name: { type: ['string', 'null'], description: 'Visible product name, or null when not identifiable.' },
    brand: { type: ['string', 'null'], description: 'Visible brand, or null when not identifiable.' },
    model: { type: ['string', 'null'], description: 'Visible model, or null when not identifiable.' },
    category: { type: ['string', 'null'], description: 'Broad product category, or null when not identifiable.' },
    product_type: { type: ['string', 'null'], description: 'Product type, or null when not identifiable.' },
    visible_condition: { type: ['string', 'null'], description: 'Only condition visible in the photos, or null.' },
    key_attributes: { type: 'object', additionalProperties: true, description: 'Observed attributes only.' },
    confidence: { type: ['number', 'null'], minimum: 0, maximum: 1, description: "The model's own estimate from 0 to 1, not a verified match." },
    identification_notes: { type: ['string', 'null'], description: 'Short notes about visible evidence and uncertainty.' },
  },
  required: ['product_name', 'brand', 'model', 'category', 'product_type', 'visible_condition', 'key_attributes', 'confidence', 'identification_notes'],
  additionalProperties: false,
} as const;

const priceFactorSchema = z.object({
  label: z.string().trim().min(1).max(200),
  impact_type: z.enum(['percentage', 'amount']),
  impact: z.number().finite(),
}).strict();

export const priceEstimateSchema = z.object({
  low: z.number().finite().positive(),
  typical: z.number().finite().positive(),
  high: z.number().finite().positive(),
  suggested_selling_price: z.number().finite().positive(),
  // Keep parsing the model's three-letter response so a mismatched currency
  // can produce the specific safe error below. Application/API inputs and
  // persisted data remain BDT-only.
  currency: z.string().regex(/^[A-Z]{3}$/),
  explanation: z.string().trim().min(1).max(4000),
  factors: z.array(priceFactorSchema).max(12).default([]),
  methodology: z.string().trim().min(1).max(4000),
  data_source: z.string().trim().min(1).max(200),
  uncertainty_note: z.string().trim().max(2000).nullable().optional().default(null),
}).strict();

export const priceEstimateJsonSchema = {
  type: 'object',
  properties: {
    low: { type: 'number', description: 'Positive lower preliminary estimate.' },
    typical: { type: 'number', description: 'Positive typical preliminary estimate.' },
    high: { type: 'number', description: 'Positive upper preliminary estimate.' },
    suggested_selling_price: { type: 'number', description: 'Suggested price within a sensible band around the range.' },
    currency: { type: 'string', description: 'Must be the requested BDT currency code.' },
    explanation: { type: 'string', description: 'Evidence-based explanation without comparables or live market claims.' },
    factors: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, impact_type: { type: 'string', enum: ['percentage', 'amount'] }, impact: { type: 'number' } }, required: ['label', 'impact_type', 'impact'], additionalProperties: false } },
    methodology: { type: 'string' },
    data_source: { type: 'string' },
    uncertainty_note: { type: ['string', 'null'] },
  },
  required: ['low', 'typical', 'high', 'suggested_selling_price', 'currency', 'explanation', 'factors', 'methodology', 'data_source', 'uncertainty_note'],
  additionalProperties: false,
} as const;

export const listingGenerationSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(10000),
  condition_description: z.string().trim().min(1).max(2000),
  selling_points: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
  suggested_price: z.number().finite().positive().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  keywords: z.array(z.string().trim().min(1).max(80)).max(20),
}).strict();

export const listingGenerationJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'SEO-friendly title within the requested marketplace limit.' },
    description: { type: 'string', description: 'Detailed factual description using confirmed data only.' },
    condition_description: { type: 'string', description: 'Condition wording based only on confirmed condition.' },
    selling_points: { type: 'array', items: { type: 'string' }, description: 'Factual selling points only.' },
    suggested_price: { type: ['number', 'null'], description: 'Must exactly match the supplied estimate or edited price.' },
    currency: { type: 'string', description: 'The supplied target currency.' },
    keywords: { type: 'array', items: { type: 'string' }, description: 'Search keywords based only on confirmed data.' },
  },
  required: ['title', 'description', 'condition_description', 'selling_points', 'suggested_price', 'currency', 'keywords'],
  additionalProperties: false,
} as const;

function stripJsonFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

export function parseIdentificationResponse(value: string | null | undefined): IdentificationResult {
  if (!value?.trim()) throw new GeminiServiceError('GEMINI_EMPTY_RESULT', 'Gemini returned no identification result.');
  let json: unknown;
  try {
    json = JSON.parse(stripJsonFence(value));
  } catch {
    throw new GeminiServiceError('GEMINI_MALFORMED_RESPONSE', 'Gemini returned malformed identification data.');
  }
  const parsed = identificationSchema.safeParse(json);
  if (!parsed.success) throw new GeminiServiceError('GEMINI_MALFORMED_RESPONSE', 'Gemini returned an invalid identification shape.');
  return parsed.data;
}

export function parsePriceEstimateResponse(value: string | null | undefined, requestedCurrency: string): PriceEstimateResult {
  if (!value?.trim()) throw new GeminiServiceError('GEMINI_EMPTY_RESULT', 'Gemini returned no price estimate.', true);
  let json: unknown;
  try { json = JSON.parse(stripJsonFence(value)); } catch { throw new GeminiServiceError('GEMINI_MALFORMED_RESPONSE', 'Gemini returned malformed price data.', true); }
  const parsed = priceEstimateSchema.safeParse(json);
  if (!parsed.success) throw new GeminiServiceError('GEMINI_MALFORMED_RESPONSE', 'Gemini returned an invalid price estimate shape.', true);
  if (parsed.data.currency !== requestedCurrency) throw new GeminiServiceError('GEMINI_MALFORMED_RESPONSE', 'Gemini returned a different currency than requested.', true);
  if (!(parsed.data.low <= parsed.data.typical && parsed.data.typical <= parsed.data.high)) throw new GeminiServiceError('GEMINI_MALFORMED_RESPONSE', 'Gemini returned an out-of-order price range.', true);
  const minSuggested = parsed.data.low * 0.75;
  const maxSuggested = parsed.data.high * 1.25;
  if (parsed.data.suggested_selling_price < minSuggested || parsed.data.suggested_selling_price > maxSuggested) throw new GeminiServiceError('GEMINI_MALFORMED_RESPONSE', 'Gemini returned an unreasonable suggested selling price.', true);
  return parsed.data;
}

export function parseListingGenerationResponse(value: string | null | undefined, options: { currency: string; suggestedPrice: number | null; titleMaxLength: number }): ListingGenerationResult {
  if (!value?.trim()) throw new GeminiServiceError('GEMINI_EMPTY_RESULT', 'Gemini returned no listing draft.', true);
  let json: unknown;
  try { json = JSON.parse(stripJsonFence(value)); } catch { throw new GeminiServiceError('GEMINI_MALFORMED_RESPONSE', 'Gemini returned malformed listing data.', true); }
  const parsed = listingGenerationSchema.safeParse(json);
  if (!parsed.success) throw new GeminiServiceError('GEMINI_MALFORMED_RESPONSE', 'Gemini returned an invalid listing shape.', true);
  if (parsed.data.title.length > options.titleMaxLength) throw new GeminiServiceError('GEMINI_MALFORMED_RESPONSE', 'Gemini returned a title above the marketplace limit.', true);
  if (parsed.data.currency !== options.currency) throw new GeminiServiceError('GEMINI_MALFORMED_RESPONSE', 'Gemini returned a different currency than requested.', true);
  if (parsed.data.suggested_price !== options.suggestedPrice) throw new GeminiServiceError('GEMINI_MALFORMED_RESPONSE', 'Gemini returned a price different from the confirmed estimate.', true);
  return parsed.data;
}

export function isEmptyIdentification(result: IdentificationResult): boolean {
  return !result.product_name && !result.brand && !result.model && !result.category && !result.product_type && !result.visible_condition && Object.keys(result.key_attributes).length === 0;
}
