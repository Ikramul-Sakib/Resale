# ResaleIQ database and Phase 9 reporting

The migrations create the Supabase PostgreSQL schema, ownership policies, private product-image
storage, and Phase 9 reporting indexes. The Express API is the trusted service-role consumer;
browser clients never receive the service-role key.

## Local commands

Prerequisites:

- Supabase CLI 3.2.0 or newer
- Docker Desktop with a running Docker daemon

From the repository root:

```sh
supabase start
supabase db reset
supabase test db
```

`supabase db reset` recreates the local database, applies every migration in `supabase/migrations/`, and runs `supabase/seed.sql`. `supabase test db` runs the SQL tests in `supabase/tests/`.

## Tables

### User-owned data

These tables have a required `user_id` and RLS policies based on `auth.uid()`:

- `scans`
- `scan_images`
- `identified_items`
- `price_estimates`
- `inventory_items`
- `listing_drafts`
- `sales`
- `market_price_observations`
- `audit_events`

`profiles.id` is the authenticated user ID and is also protected by RLS.

Composite foreign keys carry ownership across related rows. For example, an inventory item can only reference an identified item or estimate with the same `user_id`. `scan_images.storage_path` must start with the owning user UUID.

### Reference data

`categories`, `brands`, `marketplaces`, and `marketplace_fee_rules` have RLS enabled and are readable by authenticated users. They have no authenticated-user write policies or write grants.

`marketplace_fee_rules` stores `source`, nullable `verified_at`, and `is_placeholder`. A non-placeholder fee rule must have `verified_at`; the development seed contains only an explicitly labelled placeholder with no percentage or fixed amount.

## Money and estimate safety

Money is stored as `NUMERIC(12,2)` with a companion `BDT` currency column. The BDT-only migration rejects non-BDT values; it never silently relabels existing money. Price estimates enforce:

```text
low <= typical <= high
```

AI estimates default to `source = 'ai_preliminary'` and `live_market_data_used = false`. No marketplace comparables or fee percentages are seeded.

## Storage

The `product-images` bucket is private, accepts JPEG/PNG/WebP files up to 10 MB, and uses this path convention:

```text
<auth.uid()>/<filename>
```

Authenticated users can read, create, update, or delete only objects whose first path segment equals their own UUID. The Storage policies are in `20261117201000_storage_product_images.sql`.

## Development seed

`supabase/seed.sql` is development-only. It seeds categories, brands, and an active placeholder
marketplace labelled `DEMO` so the fee calculator can be exercised without claiming a fee rule. It
conditionally inserts demo user rows only if the explicit development auth UUID already exists; it
never creates an auth user and never inserts a real key or verified marketplace fee.

## Tests

`supabase/tests/001_rls_constraints_storage.sql` uses pgTAP to verify:

- cross-user scan reads and writes are blocked;
- the ordered price range checks reject invalid estimates;
- cross-user Storage reads and writes are blocked;
- development reference data is present.

These tests must be run against the local Supabase database. No production database is targeted by this repository phase.

## Phase 9 indexes and data boundaries

`20261118110000_phase9_reporting_indexes.sql` adds owner-first indexes for inventory condition,
category/status, purchase-price sorting, sales currency/date reporting, estimate history, and scan
status/date filtering. Existing RLS covers every Phase 9 table; no new user-data table was added.

The existing `record_sale` function verifies ownership, marks the inventory row sold, and inserts
the sale atomically. Shipping and payment details are currently stored in validated sale attributes.
Analytics currently reports money in BDT. Price Guides show saved user estimates and observations only;
without observation rows the correct state is “No verified market data connected yet.”
