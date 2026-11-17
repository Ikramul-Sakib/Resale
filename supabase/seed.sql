-- DEVELOPMENT ONLY.
-- These rows are intentionally labelled demo/placeholder data and must not be used
-- as live market evidence or production marketplace fee configuration.

insert into public.categories (slug, name, attributes)
values
  ('demo-computer-accessories', 'Computer accessories (DEMO)', '{"demo": true}'::jsonb),
  ('demo-cameras', 'Cameras (DEMO)', '{"demo": true}'::jsonb),
  ('demo-footwear', 'Footwear (DEMO)', '{"demo": true}'::jsonb)
on conflict (slug) do update set
  name = excluded.name,
  attributes = excluded.attributes;

insert into public.brands (slug, name, attributes)
values
  ('demo-keychron', 'Keychron (DEMO)', '{"demo": true}'::jsonb),
  ('demo-generic', 'Generic brand (DEMO)', '{"demo": true}'::jsonb)
on conflict (slug) do update set
  name = excluded.name,
  attributes = excluded.attributes;

insert into public.marketplaces (slug, name, website_url, is_active)
values
  ('demo-marketplace', 'Demo marketplace (PLACEHOLDER)', 'https://example.invalid', false)
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  is_active = excluded.is_active;

insert into public.marketplace_fee_rules (
  marketplace_id,
  name,
  fee_type,
  source,
  verified_at,
  is_placeholder,
  metadata
)
select
  id,
  'Fee rule placeholder — replace with verified source',
  'placeholder',
  'DEMO PLACEHOLDER: no marketplace percentage supplied or verified',
  null,
  true,
  '{"demo": true, "requires_verified_source": true}'::jsonb
from public.marketplaces
where slug = 'demo-marketplace'
on conflict do nothing;

-- Optional demo user rows are inserted only when a local auth user with this
-- explicit development UUID already exists. No auth user is created here.
do $$
declare
  demo_user_id constant uuid := '00000000-0000-0000-0000-000000000001';
  demo_category_id uuid;
  demo_brand_id uuid;
  demo_scan_id uuid;
  demo_item_id uuid;
  demo_estimate_id uuid;
begin
  if exists (select 1 from auth.users where id = demo_user_id) then
    insert into public.profiles (id, display_name, default_currency, preferences)
    values (demo_user_id, 'Demo Reseller', 'USD', '{"demo": true}'::jsonb)
    on conflict (id) do update set
      display_name = excluded.display_name,
      preferences = excluded.preferences;

    select id into demo_category_id from public.categories where slug = 'demo-computer-accessories';
    select id into demo_brand_id from public.brands where slug = 'demo-keychron';

    insert into public.scans (user_id, status, source, metadata)
    values (demo_user_id, 'completed', 'demo', '{"demo": true, "label": "DEMO DATA"}'::jsonb)
    returning id into demo_scan_id;

    insert into public.identified_items (
      scan_id, user_id, category_id, brand_id, name, model, condition,
      key_attributes, review_status
    ) values (
      demo_scan_id, demo_user_id, demo_category_id, demo_brand_id,
      'Mechanical keyboard (DEMO)', 'K2 (DEMO)', 'Good, light wear',
      '{"demo": true, "wireless": true}'::jsonb, 'needs_review'
    ) returning id into demo_item_id;

    insert into public.price_estimates (
      identified_item_id, scan_id, user_id, low, typical, high,
      suggested_price, currency, source, live_market_data_used,
      factors, methodology
    ) values (
      demo_item_id, demo_scan_id, demo_user_id, 55, 79, 95,
      79, 'USD', 'demo_ai_preliminary', false,
      '{"demo": true}'::jsonb,
      'DEMO ONLY. AI preliminary estimate; live market data was not used.'
    ) returning id into demo_estimate_id;

    insert into public.inventory_items (
      user_id, identified_item_id, price_estimate_id, category_id, brand_id,
      item_name, condition, estimated_value, estimated_value_currency,
      attributes
    ) values (
      demo_user_id, demo_item_id, demo_estimate_id, demo_category_id, demo_brand_id,
      'Mechanical keyboard (DEMO)', 'Good, light wear', 79, 'USD',
      '{"demo": true}'::jsonb
    );
  end if;
end;
$$;
