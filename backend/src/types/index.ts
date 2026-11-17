import type { NextFunction, Request, Response } from 'express';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export interface RequestWithContext extends Request {
  requestId: string;
  user?: AuthenticatedUser;
  validated?: {
    body?: unknown;
    params?: unknown;
    query?: unknown;
  };
}

export type AsyncHandler = (
  req: RequestWithContext,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

export interface Page<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  identified_item_id?: string | null;
  price_estimate_id?: string | null;
  category_id?: string | null;
  brand_id?: string | null;
  item_name: string;
  condition?: string | null;
  status: 'owned' | 'listed' | 'sold' | 'archived';
  purchase_price?: number | null;
  purchase_currency?: string | null;
  estimated_value?: number | null;
  estimated_value_currency?: string | null;
  listing_price?: number | null;
  listing_currency?: string | null;
  attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SalesRecord {
  id: string;
  user_id: string;
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
  created_at: string;
  updated_at: string;
}

export interface Marketplace {
  id: string;
  slug: string;
  name: string;
  website_url?: string | null;
  is_active: boolean;
  title_max_length?: number;
  created_at: string;
  updated_at: string;
}

export interface FeeRule {
  id: string;
  marketplace_id: string;
  name: string;
  fee_type: 'percentage' | 'fixed' | 'mixed' | 'placeholder';
  percentage_rate?: number | null;
  fixed_amount?: number | null;
  currency?: string | null;
  source: string;
  verified_at?: string | null;
  is_placeholder: boolean;
}

export interface ListingDraft {
  id: string;
  user_id: string;
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
  created_at: string;
  updated_at: string;
}
