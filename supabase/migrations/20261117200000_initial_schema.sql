-- ResaleIQ initial database schema.
-- User-owned rows always carry user_id and are protected by RLS policies below.

create extension if not exists pgcrypto;
create extension if not exists pgtap with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  default_currency text not null default 'USD'
    check (default_currency ~ '^[A-Z]{3}$'),
  preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preferences) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug <> ''),
  name text not null check (name <> ''),
  parent_id uuid references public.categories(id) on delete set null,
  attributes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug <> ''),
  name text not null check (name <> ''),
  attributes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'identifying', 'identified', 'estimating', 'completed', 'failed')),
  source text not null default 'upload'
    check (source in ('upload', 'camera', 'demo')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id)
);

create table public.scan_images (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null check (storage_path <> ''),
  original_filename text not null check (original_filename <> ''),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  sort_order integer not null default 0 check (sort_order >= 0 and sort_order < 6),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, storage_path),
  foreign key (scan_id, user_id) references public.scans(id, user_id) on delete cascade,
  check (split_part(storage_path, '/', 1) = user_id::text)
);

create table public.identified_items (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  name text not null check (name <> ''),
  model text,
  condition text,
  key_attributes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(key_attributes) = 'object'),
  confidence_score numeric(5, 4)
    check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'reviewed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (scan_id, user_id) references public.scans(id, user_id) on delete cascade
);

create table public.price_estimates (
  id uuid primary key default gen_random_uuid(),
  identified_item_id uuid not null,
  scan_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  low numeric(12, 2) not null check (low >= 0),
  typical numeric(12, 2) not null check (typical >= 0),
  high numeric(12, 2) not null check (high >= 0),
  suggested_price numeric(12, 2) check (suggested_price is null or suggested_price >= 0),
  estimated_fee_amount numeric(12, 2) check (estimated_fee_amount is null or estimated_fee_amount >= 0),
  estimated_net_earnings numeric(12, 2) check (estimated_net_earnings is null or estimated_net_earnings >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  source text not null default 'ai_preliminary',
  live_market_data_used boolean not null default false,
  factors jsonb not null default '{}'::jsonb
    check (jsonb_typeof(factors) = 'object'),
  methodology text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (identified_item_id, user_id) references public.identified_items(id, user_id) on delete cascade,
  foreign key (scan_id, user_id) references public.scans(id, user_id) on delete cascade,
  constraint price_estimates_ordered_range check (low <= typical and typical <= high),
  constraint price_estimates_suggested_in_range check (
    suggested_price is null or (suggested_price >= low and suggested_price <= high)
  )
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  identified_item_id uuid,
  price_estimate_id uuid,
  category_id uuid references public.categories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  item_name text not null check (item_name <> ''),
  condition text,
  status text not null default 'owned'
    check (status in ('owned', 'listed', 'sold', 'archived')),
  purchase_price numeric(12, 2) check (purchase_price is null or purchase_price >= 0),
  purchase_currency text check (purchase_currency is null or purchase_currency ~ '^[A-Z]{3}$'),
  estimated_value numeric(12, 2) check (estimated_value is null or estimated_value >= 0),
  estimated_value_currency text check (
    estimated_value_currency is null or estimated_value_currency ~ '^[A-Z]{3}$'
  ),
  listing_price numeric(12, 2) check (listing_price is null or listing_price >= 0),
  listing_currency text check (listing_currency is null or listing_currency ~ '^[A-Z]{3}$'),
  attributes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (identified_item_id, user_id) references public.identified_items(id, user_id) on delete set null,
  foreign key (price_estimate_id, user_id) references public.price_estimates(id, user_id) on delete set null
);

create table public.marketplaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug <> ''),
  name text not null check (name <> ''),
  website_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.marketplace_fee_rules (
  id uuid primary key default gen_random_uuid(),
  marketplace_id uuid not null references public.marketplaces(id) on delete cascade,
  name text not null check (name <> ''),
  fee_type text not null check (fee_type in ('percentage', 'fixed', 'mixed', 'placeholder')),
  percentage_rate numeric(7, 4) check (percentage_rate is null or (percentage_rate >= 0 and percentage_rate <= 100)),
  fixed_amount numeric(12, 2) check (fixed_amount is null or fixed_amount >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  source text not null check (source <> ''),
  verified_at timestamptz,
  is_placeholder boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fee_rule_shape check (
    (fee_type = 'percentage' and percentage_rate is not null and fixed_amount is null)
    or (fee_type = 'fixed' and fixed_amount is not null and percentage_rate is null)
    or (fee_type = 'mixed' and (percentage_rate is not null or fixed_amount is not null))
    or (fee_type = 'placeholder' and percentage_rate is null and fixed_amount is null)
  ),
  constraint verified_fee_rule_has_timestamp check (is_placeholder or verified_at is not null)
);

create table public.listing_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id uuid not null,
  marketplace_id uuid references public.marketplaces(id) on delete set null,
  title text not null check (title <> ''),
  description text,
  condition text,
  asking_price numeric(12, 2) check (asking_price is null or asking_price >= 0),
  asking_currency text check (asking_currency is null or asking_currency ~ '^[A-Z]{3}$'),
  attributes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(attributes) = 'object'),
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (inventory_item_id, user_id) references public.inventory_items(id, user_id) on delete cascade
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id uuid not null,
  marketplace_id uuid references public.marketplaces(id) on delete set null,
  sale_price numeric(12, 2) not null check (sale_price >= 0),
  sale_currency text not null check (sale_currency ~ '^[A-Z]{3}$'),
  fee_amount numeric(12, 2) not null default 0 check (fee_amount >= 0),
  fee_currency text not null check (fee_currency ~ '^[A-Z]{3}$'),
  net_earnings numeric(12, 2) not null check (net_earnings >= 0),
  net_currency text not null check (net_currency ~ '^[A-Z]{3}$'),
  sold_at timestamptz not null,
  attributes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (inventory_item_id, user_id) references public.inventory_items(id, user_id) on delete restrict
);

create table public.market_price_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  identified_item_id uuid,
  product_name text not null check (product_name <> ''),
  observed_price numeric(12, 2) not null check (observed_price >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  source text not null check (source <> ''),
  source_listing_id text,
  observed_at timestamptz not null,
  attributes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (identified_item_id, user_id) references public.identified_items(id, user_id) on delete set null
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action <> ''),
  entity_type text not null check (entity_type <> ''),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id)
);

create index scans_user_created_at_idx on public.scans(user_id, created_at desc);
create index scans_user_status_idx on public.scans(user_id, status);
create index scan_images_scan_id_idx on public.scan_images(scan_id, sort_order);
create index identified_items_user_created_at_idx on public.identified_items(user_id, created_at desc);
create index identified_items_category_id_idx on public.identified_items(category_id);
create index price_estimates_item_created_at_idx on public.price_estimates(identified_item_id, created_at desc);
create index price_estimates_user_created_at_idx on public.price_estimates(user_id, created_at desc);
create index inventory_items_user_status_idx on public.inventory_items(user_id, status);
create index inventory_items_user_created_at_idx on public.inventory_items(user_id, created_at desc);
create index listing_drafts_user_updated_at_idx on public.listing_drafts(user_id, updated_at desc);
create index marketplace_fee_rules_marketplace_idx on public.marketplace_fee_rules(marketplace_id, is_placeholder);
create index sales_user_sold_at_idx on public.sales(user_id, sold_at desc);
create index market_price_observations_user_observed_at_idx on public.market_price_observations(user_id, observed_at desc);
create index audit_events_user_created_at_idx on public.audit_events(user_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'categories', 'brands', 'scans', 'scan_images', 'identified_items',
    'price_estimates', 'inventory_items', 'listing_drafts', 'marketplaces',
    'marketplace_fee_rules', 'sales', 'market_price_observations', 'audit_events'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_set_updated_at', table_name
    );
  end loop;
end;
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.scans enable row level security;
alter table public.scan_images enable row level security;
alter table public.identified_items enable row level security;
alter table public.price_estimates enable row level security;
alter table public.inventory_items enable row level security;
alter table public.listing_drafts enable row level security;
alter table public.marketplaces enable row level security;
alter table public.marketplace_fee_rules enable row level security;
alter table public.sales enable row level security;
alter table public.market_price_observations enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy categories_authenticated_read on public.categories
  for select to authenticated using (true);
create policy brands_authenticated_read on public.brands
  for select to authenticated using (true);
create policy marketplaces_authenticated_read on public.marketplaces
  for select to authenticated using (true);
create policy marketplace_fee_rules_authenticated_read on public.marketplace_fee_rules
  for select to authenticated using (true);

create policy scans_owner_all on public.scans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy scan_images_owner_all on public.scan_images
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy identified_items_owner_all on public.identified_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy price_estimates_owner_all on public.price_estimates
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy inventory_items_owner_all on public.inventory_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy listing_drafts_owner_all on public.listing_drafts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy sales_owner_all on public.sales
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy market_price_observations_owner_all on public.market_price_observations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy audit_events_owner_read on public.audit_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy audit_events_owner_insert on public.audit_events
  for insert to authenticated with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select on public.categories, public.brands, public.marketplaces, public.marketplace_fee_rules to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.scans, public.scan_images, public.identified_items,
  public.price_estimates, public.inventory_items, public.listing_drafts, public.sales,
  public.market_price_observations to authenticated;
grant select, insert on public.audit_events to authenticated;
