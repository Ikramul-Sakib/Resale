-- Phase 6: fields returned by product identification and editable during review.
alter table public.identified_items
  add column if not exists brand_text text,
  add column if not exists category_text text,
  add column if not exists product_type text,
  add column if not exists identification_notes text,
  add column if not exists identification_source text not null default 'gemini';

alter table public.identified_items
  add constraint identified_items_brand_text_length check (brand_text is null or char_length(brand_text) <= 200),
  add constraint identified_items_category_text_length check (category_text is null or char_length(category_text) <= 200),
  add constraint identified_items_product_type_length check (product_type is null or char_length(product_type) <= 200),
  add constraint identified_items_identification_notes_length check (identification_notes is null or char_length(identification_notes) <= 4000),
  add constraint identified_items_identification_source check (identification_source in ('gemini', 'mock'));
