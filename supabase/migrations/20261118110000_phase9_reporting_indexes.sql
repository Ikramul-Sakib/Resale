-- Phase 9 additive indexes for authenticated owner-scoped filtering and reporting.
create index if not exists inventory_items_user_condition_idx
  on public.inventory_items(user_id, condition);
create index if not exists inventory_items_user_category_status_idx
  on public.inventory_items(user_id, category_id, status);
create index if not exists inventory_items_user_purchase_price_idx
  on public.inventory_items(user_id, purchase_price desc);
create index if not exists sales_user_currency_sold_at_idx
  on public.sales(user_id, sale_currency, sold_at desc);
create index if not exists price_estimates_user_item_created_idx
  on public.price_estimates(user_id, identified_item_id, created_at desc);
create index if not exists scans_user_status_created_idx
  on public.scans(user_id, status, created_at desc);
