alter table public.price_estimates
  add column if not exists explanation text,
  add column if not exists data_source text not null default 'ai_preliminary',
  add column if not exists model_id text,
  add column if not exists prompt_version text,
  add column if not exists uncertainty_note text,
  add column if not exists marketplace_id uuid references public.marketplaces(id) on delete set null,
  add column if not exists purchase_price numeric(12, 2),
  add column if not exists purchase_currency text,
  add column if not exists market_data_status text not null default 'not_connected',
  add column if not exists fee_rule_status text not null default 'not_verified';

alter table public.price_estimates
  drop constraint if exists price_estimates_suggested_in_range;

alter table public.price_estimates
  add constraint price_estimates_purchase_price_check check (purchase_price is null or purchase_price >= 0),
  add constraint price_estimates_purchase_currency_check check (purchase_currency is null or purchase_currency ~ '^[A-Z]{3}$'),
  add constraint price_estimates_market_data_status_check check (market_data_status in ('not_connected', 'connected')),
  add constraint price_estimates_fee_rule_status_check check (fee_rule_status in ('verified', 'not_verified', 'user_entered_unverified')),
  add constraint price_estimates_suggested_price_band_check check (suggested_price is null or (suggested_price >= low * 0.75 and suggested_price <= high * 1.25));

create index if not exists price_estimates_item_created_idx on public.price_estimates (identified_item_id, created_at desc);
create index if not exists price_estimates_user_item_idx on public.price_estimates (user_id, identified_item_id, currency, created_at desc);
