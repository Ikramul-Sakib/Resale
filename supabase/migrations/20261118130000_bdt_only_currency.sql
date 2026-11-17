-- ResaleIQ uses Bangladeshi taka only. Existing non-BDT values must be
-- migrated explicitly; this migration never relabels money silently.
do $$
begin
  if exists (select 1 from public.profiles where default_currency <> 'BDT')
    or exists (select 1 from public.price_estimates where currency <> 'BDT' or (purchase_currency is not null and purchase_currency <> 'BDT'))
    or exists (select 1 from public.inventory_items where (purchase_currency is not null and purchase_currency <> 'BDT') or (estimated_value_currency is not null and estimated_value_currency <> 'BDT') or (listing_currency is not null and listing_currency <> 'BDT'))
    or exists (select 1 from public.marketplace_fee_rules where currency is not null and currency <> 'BDT')
    or exists (select 1 from public.listing_drafts where asking_currency is not null and asking_currency <> 'BDT')
    or exists (select 1 from public.sales where sale_currency <> 'BDT' or fee_currency <> 'BDT' or net_currency <> 'BDT')
    or exists (select 1 from public.market_price_observations where currency <> 'BDT') then
    raise exception 'BDT-only migration blocked: existing non-BDT money values require an explicit migration';
  end if;
end;
$$;

alter table public.profiles alter column default_currency set default 'BDT';
alter table public.price_estimates alter column currency set default 'BDT';

alter table public.profiles add constraint profiles_default_currency_bdt_check check (default_currency = 'BDT');
alter table public.price_estimates add constraint price_estimates_currency_bdt_check check (currency = 'BDT');
alter table public.price_estimates add constraint price_estimates_purchase_currency_bdt_check check (purchase_currency is null or purchase_currency = 'BDT');
alter table public.inventory_items add constraint inventory_purchase_currency_bdt_check check (purchase_currency is null or purchase_currency = 'BDT');
alter table public.inventory_items add constraint inventory_estimated_currency_bdt_check check (estimated_value_currency is null or estimated_value_currency = 'BDT');
alter table public.inventory_items add constraint inventory_listing_currency_bdt_check check (listing_currency is null or listing_currency = 'BDT');
alter table public.marketplace_fee_rules add constraint fee_rule_currency_bdt_check check (currency is null or currency = 'BDT');
alter table public.listing_drafts add constraint listing_asking_currency_bdt_check check (asking_currency is null or asking_currency = 'BDT');
alter table public.sales add constraint sales_sale_currency_bdt_check check (sale_currency = 'BDT');
alter table public.sales add constraint sales_fee_currency_bdt_check check (fee_currency = 'BDT');
alter table public.sales add constraint sales_net_currency_bdt_check check (net_currency = 'BDT');
alter table public.market_price_observations add constraint observations_currency_bdt_check check (currency = 'BDT');
