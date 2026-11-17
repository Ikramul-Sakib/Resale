alter table public.marketplaces
  add column if not exists title_max_length integer not null default 120;

alter table public.marketplaces
  add constraint marketplaces_title_max_length_check check (title_max_length between 20 and 300);

alter table public.listing_drafts
  alter column inventory_item_id drop not null,
  add column if not exists identified_item_id uuid;

alter table public.listing_drafts
  drop constraint if exists listing_drafts_inventory_item_id_user_id_fkey;

alter table public.listing_drafts
  add constraint listing_drafts_inventory_item_id_user_id_fkey
    foreign key (inventory_item_id, user_id)
    references public.inventory_items(id, user_id) on delete cascade,
  add constraint listing_drafts_identified_item_id_user_id_fkey
    foreign key (identified_item_id, user_id)
    references public.identified_items(id, user_id) on delete cascade,
  add constraint listing_drafts_item_source_check
    check (inventory_item_id is not null or identified_item_id is not null);

create index if not exists listing_drafts_user_item_idx on public.listing_drafts(user_id, identified_item_id, updated_at desc);
create index if not exists listing_drafts_marketplace_idx on public.listing_drafts(user_id, marketplace_id, updated_at desc);
