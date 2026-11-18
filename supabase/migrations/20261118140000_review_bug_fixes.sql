-- Allow sale proceeds below zero and enable text searches on scan UUIDs.
alter table public.sales drop constraint if exists sales_net_earnings_check;
alter table public.scans add column id_search text generated always as (id::text) stored;

-- Atomic sales flow for the API: mark the owner's inventory item sold and
-- insert the sale in the same database transaction.

create or replace function public.record_sale(
  p_user_id uuid,
  p_inventory_item_id uuid,
  p_marketplace_id uuid,
  p_sale_price numeric,
  p_sale_currency text,
  p_fee_amount numeric,
  p_fee_currency text,
  p_net_earnings numeric,
  p_net_currency text,
  p_sold_at timestamptz,
  p_attributes jsonb default '{}'::jsonb
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_item_id uuid;
  created_sale public.sales;
  purchase_cost numeric;
begin
  if p_user_id is null or p_inventory_item_id is null then
    raise exception using errcode = '22023', message = 'Sale owner and inventory item are required';
  end if;

  update public.inventory_items
  set status = 'sold', updated_at = timezone('utc', now())
  where id = p_inventory_item_id
    and user_id = p_user_id
    and status <> 'sold'
  returning id, coalesce(purchase_price, 0) into updated_item_id, purchase_cost;

  if updated_item_id is null then
    raise exception using errcode = 'P0002', message = 'Inventory item was not found or is already sold';
  end if;

  insert into public.sales (
    user_id,
    inventory_item_id,
    marketplace_id,
    sale_price,
    sale_currency,
    fee_amount,
    fee_currency,
    net_earnings,
    net_currency,
    sold_at,
    attributes
  ) values (
    p_user_id,
    p_inventory_item_id,
    p_marketplace_id,
    p_sale_price,
    p_sale_currency,
    p_fee_amount,
    p_fee_currency,
    round(p_sale_price, 2) - round(p_fee_amount, 2),
    p_net_currency,
    p_sold_at,
    coalesce(p_attributes, '{}'::jsonb) || jsonb_build_object('purchase_cost', purchase_cost)
  ) returning * into created_sale;

  return created_sale;
end;
$$;

revoke all on function public.record_sale(uuid, uuid, uuid, numeric, text, numeric, text, numeric, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_sale(uuid, uuid, uuid, numeric, text, numeric, text, numeric, text, timestamptz, jsonb)
  to service_role;
