# ResaleIQ API

The backend is an Express REST API under `/api/v1`. Route handlers validate requests, call services, and return JSON. Services hold business rules; repositories hold Supabase access and always apply the authenticated owner ID server-side.

## Running locally

```sh
supabase start
npm run dev --workspace backend
```

The backend requires the variables in `.env.example`. The Supabase service-role key is loaded only by the backend process.

## Authentication

All `/api/v1/*` routes require:

```http
Authorization: Bearer <supabase-access-token>
```

The backend verifies the token with Supabase and derives `user_id` from the verified token. Client-supplied `user_id` values are rejected by strict Zod schemas and are never used for ownership decisions.

## Response and errors

Successful list responses use a consistent pagination envelope:

```json
{
  "data": [],
  "page": 1,
  "limit": 25,
  "total": 0,
  "total_pages": 0
}
```

Errors use one shape. `request_id` can be used to correlate a server log without exposing a stack trace or secret:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "request_id": "2b8c7a2a-4ee5-4e08-9050-9f3b420a8f10",
    "details": [
      { "path": ["item_name"], "message": "Too small: expected string to have >=1 characters" }
    ]
  }
}
```

Common status codes:

| Status | Meaning |
| --- | --- |
| 200 | Successful read/update/calculation |
| 201 | Resource created |
| 204 | Resource deleted |
| 400 | Invalid request or database constraint |
| 401 | Missing or invalid Supabase access token |
| 403 | Disallowed CORS origin |
| 404 | Resource or route not found; ownership misses are not disclosed |
| 409 | Unique conflict |
| 422 | Valid request but no usable configured fee rule |
| 429 | Rate limit exceeded |
| 501 | Feature intentionally unavailable in the current phase |

## Endpoints

### Health and auth

`GET /health` is public:

```json
{ "status": "ok", "service": "resaleiq-api" }
```

`GET /api/v1/auth/me` returns the verified user and their optional profile:

```json
{
  "user": { "id": "<uuid>", "email": "seller@example.com" },
  "profile": null
}
```

### Inventory

- `GET /api/v1/inventory?page=1&limit=25&search=keyboard&status=owned&category_id=<uuid>&sort=created_at&order=desc`
- `POST /api/v1/inventory`
- `GET /api/v1/inventory/:id`
- `PATCH /api/v1/inventory/:id`
- `DELETE /api/v1/inventory/:id`

Create example:

```json
{
  "item_name": "Mechanical keyboard",
  "condition": "Good, light wear",
  "status": "owned",
  "estimated_value": 79,
  "estimated_value_currency": "BDT",
  "attributes": { "wireless": true }
}
```

`user_id` is not accepted. It is assigned from the verified token.

### Sales

- `GET /api/v1/sales?page=1&limit=25&inventory_item_id=<uuid>&sort=sold_at&order=desc`
- `POST /api/v1/sales`

```json
{
  "inventory_item_id": "<uuid>",
  "marketplace_id": "<uuid>",
  "sale_price": 80,
  "sale_currency": "BDT",
  "fee_amount": 10,
  "fee_currency": "BDT",
  "net_earnings": 70,
  "net_currency": "BDT",
  "sold_at": "2026-11-17T00:00:00.000Z",
  "attributes": {}
}
```

The backend calls the `record_sale` database function. It updates the authenticated owner's inventory status and inserts the sale in one PostgreSQL transaction.

### Marketplaces and fees

- `GET /api/v1/marketplaces`
- `POST /api/v1/fees/calculate`

```json
{
  "marketplace_id": "<uuid>",
  "sale_price": 100,
  "currency": "BDT"
}
```

Fee calculation reads a verified non-placeholder `marketplace_fee_rules` row. The response includes the rule's `source` and `verified_at`. If no verified rule exists, the API returns `422 FEE_RULE_UNAVAILABLE`; it never invents a percentage.
When a rule is unavailable, the client may send `manual_percentage`; the response is marked
`user_entered_unverified` and has no verification timestamp.

### AI price estimates

- `POST /api/v1/items/:id/estimate`
- `GET /api/v1/estimates/:id`
- `GET /api/v1/pricing/history?item_id=:id&page=1&limit=25`

The estimate request accepts `{ "currency": "BDT", "purchase_price": 20, "marketplace_id": null,
"force": false }`. The item must have been reviewed by the user. Repeated requests within one
minute return the cached estimate unless `force` is true. Currency changes request a new estimate.
Every response includes `ai_mode`, `data_source`, `model_id`, `prompt_version`, `market_data_status`,
and an uncertainty note when the model returned one. Prices are always labelled AI preliminary
estimates; live marketplace data is not used. No comparables or confidence scores are fabricated.

### Analytics

- `GET /api/v1/analytics/dashboard`

The response is calculated from the authenticated user's inventory and sales rows. No dashboard numbers are hardcoded.

### Scans and items

- `GET /api/v1/scans?page=1&limit=25`
- `GET /api/v1/scans/:id`
- `POST /api/v1/scans` (multipart upload)
- `POST /api/v1/scans/:id/retry`
- `GET /api/v1/items/:id`
- `PATCH /api/v1/items/:id`
- `GET /api/v1/pricing/history?page=1&limit=25`
- `GET /api/v1/estimates/:id`

`POST /api/v1/scans` expects one to six multipart files under `images` and an optional
`source=upload|camera` field. The backend checks JPG/PNG/WebP magic bytes, limits each image
to 10 MB, stores files privately under `<user_id>/<scan_id>/<file>`, and returns one-hour
signed URLs. The response includes `status`, `images`, `identified_item`, `ai_mode`, and
`identification_empty`.

Example response shape:

```json
{
  "id": "<scan-uuid>",
  "status": "completed",
  "source": "upload",
  "ai_mode": "mock",
  "identification_empty": true,
  "images": [{ "signed_url": "<private-signed-url>", "mime_type": "image/jpeg" }],
  "identified_item": {
    "name": "Unknown item",
    "identification_source": "mock",
    "identification_notes": "Demo mock result — no Gemini call was made."
  }
}
```

`ai_mode=mock` is explicit and means no Gemini call was made. It is never presented as real
AI output. `ai_mode=real` is used only when the backend has both `GEMINI_API_KEY` and the
configured `GEMINI_MODEL`.

Editable item fields include `name`, `brand_text`, `model`, `category_text`, `product_type`,
`condition`, `key_attributes`, `identification_notes`, and `review_status`. Ownership is
always derived from the verified bearer token.

### Listings

- `POST /api/v1/listings/generate`
- `GET /api/v1/listings?page=1&limit=25&item_id=<uuid>&marketplace_id=<uuid>&search=keyboard`
- `POST /api/v1/listings`
- `GET /api/v1/listings/:id`
- `PATCH /api/v1/listings/:id`
- `DELETE /api/v1/listings/:id`

### Phase 9 inventory, scans, fees, analytics, and guides

`GET /api/v1/inventory` accepts owner-scoped `search`, `status`, `condition`, `category_id`,
`sort`, and `order` filters. Inventory rows may include a signed `thumbnail_url`; purchase cost,
estimated value, listing price, and actual sale price are separate fields. `PATCH` supports archive
and restore, while `DELETE` requires a user confirmation in the UI.

`GET /api/v1/scans` accepts bounded `status` and `search` filters. `DELETE /api/v1/scans/:id`
removes the owner’s private Storage files before deleting the scan. `POST /api/v1/sales` continues
to use the atomic `record_sale` function; shipping/payment details are validated and kept in sale
attributes until dedicated columns are needed.

`POST /api/v1/fees/calculate` accepts `purchase_cost`, `shipping_cost`,
`payment_processing_percentage`, and an optional `manual_percentage`. It returns fixed-cent
`total_expenses`, `net_earnings`, and `profit_margin` plus fee-rule `source` and `verified_at`.
Missing or placeholder rules are marked unverified and never presented as current rates.

`GET /api/v1/analytics/dashboard?date_from=<ISO>&date_to=<ISO>` returns real inventory, sales,
audit activity, monthly sales, status distribution, category performance, recent sales, and
currency-grouped totals. Different currencies are not silently summed. The resale-index endpoint
remains `501` because no authorized market-data provider is configured.

`GET /api/v1/price-guides?page=1&limit=25&category_id=<uuid>` shows the user’s own saved estimates
and observations with source/timestamps. Without observations the honest UI state is “No verified
market data connected yet.”

Generation accepts `{ "item_id": "<inventory-or-confirmed-item-uuid>", "marketplace_id": "<uuid>",
"currency": "BDT", "tone": "concise", "notes": "optional confirmed facts", "asking_price": 30 }`.
It returns an unsaved draft. The item must be confirmed and the price must come from the latest
estimate or an explicit user-entered price. Generation is guarded against rapid duplicate calls.
The response includes `ai_mode`; `mock` explicitly means no Gemini call was made.

`POST /api/v1/listings` saves an editable draft and creates an `audit_events` record. A draft may
reference an owned inventory item or a confirmed scanned item. `DELETE` archives the draft rather
than removing its audit history. Listing text is never published to an external marketplace.
The generator returns title, description, condition description, selling points, keywords, and the
estimate-derived suggested price. Marketplace title limits are read from the reference table.

### Remaining stubs

These routes are authenticated and intentionally return `501 NOT_IMPLEMENTED` with a clear message until later phases:

- `GET /api/v1/analytics/resale-index`

They do not fabricate price estimates, listing text, comparables, or analytics.
