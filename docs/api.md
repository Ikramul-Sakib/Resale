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
| 501 | Gemini/upload-dependent feature intentionally unavailable in Phase 4 |

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
  "estimated_value_currency": "USD",
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
  "sale_currency": "USD",
  "fee_amount": 10,
  "fee_currency": "USD",
  "net_earnings": 70,
  "net_currency": "USD",
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
  "currency": "USD"
}
```

Fee calculation reads a verified non-placeholder `marketplace_fee_rules` row. The response includes the rule's `source` and `verified_at`. If no verified rule exists, the API returns `422 FEE_RULE_UNAVAILABLE`; it never invents a percentage.

### Analytics

- `GET /api/v1/analytics/dashboard`

The response is calculated from the authenticated user's inventory and sales rows. No dashboard numbers are hardcoded.

### Scans and items

- `GET /api/v1/scans?page=1&limit=25`
- `GET /api/v1/scans/:id`
- `GET /api/v1/items/:id`
- `PATCH /api/v1/items/:id`
- `GET /api/v1/pricing/history?page=1&limit=25`
- `GET /api/v1/estimates/:id`

Editable item fields include `name`, `model`, `category_id`, `brand_id`, `condition`, `key_attributes`, and `review_status`.

### Listings

- `GET /api/v1/listings?page=1&limit=25`
- `POST /api/v1/listings`
- `PATCH /api/v1/listings/:id`
- `DELETE /api/v1/listings/:id`

`POST /api/v1/listings` saves an editable draft. It does not publish to an external marketplace.

### Phase 4 stubs

These routes are authenticated and intentionally return `501 NOT_IMPLEMENTED` with a clear message until later phases:

- `POST /api/v1/scans`
- `POST /api/v1/scans/:id/retry`
- `POST /api/v1/items/:id/estimate`
- `POST /api/v1/listings/generate`
- `GET /api/v1/analytics/resale-index`

They do not fabricate AI results, upload states, comparables, or analytics.
