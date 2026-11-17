# ResaleIQ architecture

## Phase 5 authentication boundary

The browser uses `@supabase/supabase-js` with only `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. It persists and restores the Supabase session, listens for
refresh/sign-out events, and uses a route guard so protected screens never render for an
anonymous user. The API client attaches the current access token and retries one request
after a refresh; failed refreshes sign the browser out and return the same API error shape.

Registration sends the display name as user metadata only. The migration
`20261117203000_profile_on_auth_user.sql` creates the corresponding `public.profiles` row
from `auth.users` with a `security definer` trigger. It never reads or assigns a role from
the client. Profile updates are owner-scoped by RLS. Passwords remain in Supabase Auth and
are never stored in application tables.

For local development, email confirmations are enabled and Supabase's local SMTP service
is configured for Mailpit. Read confirmation and reset messages at
`http://127.0.0.1:54324` after `supabase start`.

Authenticated users see API-backed empty states when no records exist. The amber Demo data
badge and sample values are shown only when `VITE_DEMO_MODE=true`; demo mode is not used for
authenticated sessions.

## Phase 6 image and identification boundary

Image uploads use Multer memory limits at the Express edge, then a server-side magic-byte
check accepts only JPEG, PNG, or WebP files up to 10 MB each and six files per scan. The
backend creates the owner-scoped scan, uploads each file to the private `product-images`
bucket under `<user_id>/<scan_id>/<random-file>`, and records `scan_images`. Signed URLs are
created only for the authenticated owner's response.

The scan service advances `uploaded → identifying → completed` or `failed`. Gemini calls
are made only by `backend/src/services/gemini`; image bytes, prompts, and API keys never
reach the browser or logs. Visible text in images is explicitly treated as untrusted data.
Gemini structured JSON is validated again with Zod before persistence. A failed AI call keeps
the uploaded images for `POST /scans/:id/retry`; failures before image persistence perform
best-effort storage and scan cleanup.

`GEMINI_MODEL` is mandatory when `GEMINI_API_KEY` is configured; there is no guessed model
default. `GEMINI_MOCK=true` forces the clearly labelled mock adapter for local/E2E tests.
The optional `backend/scripts/gemini-smoke.ts`, `gemini-price-smoke.ts`, and
`gemini-listing-smoke.ts` commands are documented manual real-call smoke tests. Price estimation
and listing generation remain backend-only and use the explicit mock adapter for automated runs
when real Gemini credentials are not enabled.

## Phase 4 boundary

The backend is a Node.js/Express/TypeScript REST API. This phase does not implement Gemini, image upload, frontend authentication, or external marketplace publishing.

```text
HTTP request
    │
    ├── Helmet, request ID, CORS, JSON limit, rate limit
    │
    ├── /api/v1 protected router
    │       └── Supabase JWT verification → authenticated user ID
    │
    ├── Zod request validation
    │
    ├── Thin controller
    │       └── Service business logic
    │               └── Repository ownership-scoped Supabase query
    │
    └── Consistent JSON response/error handler
```

## Backend structure

```text
backend/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── eslint.config.js
└── src/
    ├── server.ts             # validated config, Supabase client, listen()
    ├── app.ts                # Express middleware and route assembly
    ├── config/               # env, Supabase client, token verifier
    ├── routes/               # URL and validation wiring
    ├── controllers/          # HTTP translation only
    ├── services/             # business rules and service contracts
    │   ├── gemini/           # real/mock identification adapters and Zod parsing
    │   ├── image-validation.ts
    │   └── scans.ts          # upload, status, retry, signed-URL orchestration
    ├── middleware/           # auth, request IDs, validation, errors
    ├── repositories/         # Supabase data access and owner filters
    ├── validators/            # strict Zod request schemas
    ├── types/                # request and domain types
    └── utils/                # errors and pagination helpers
```

## Configuration and secrets

`src/config/env.ts` loads `.env` and validates it with Zod before the server starts. Missing or invalid values produce a clear startup error. `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are backend-only; neither is sent to a browser response. `GEMINI_MODEL` is required whenever a real Gemini key is configured.

`CORS_ORIGIN` is a comma-separated allowlist. The API rejects disallowed origins, applies Helmet, limits JSON body size, attaches an `X-Request-ID`, and rate-limits requests.

## Authentication and ownership

Protected routes require a Supabase bearer token. The auth middleware calls Supabase `auth.getUser(token)` and attaches only the verified user ID to the request. Controllers never read `user_id` from the body or query string.

Every user-owned repository method accepts `userId` separately and applies an owner filter. A missing owner-scoped row returns a generic 404, preventing cross-user existence leaks. Database RLS remains the final ownership boundary.

## Database access

The backend uses the Supabase service-role client only on the server. The service role is necessary for the trusted API repository layer, while the API itself enforces the verified user ID in every query.

The sales repository calls the Phase 4 `record_sale` PostgreSQL function. That function updates the owner-scoped inventory item and inserts the sales row in one transaction. Its execute privilege is restricted to `service_role`; the backend supplies the user ID derived from the verified token.

Fee calculation reads configurable, verified database rules and returns provenance. Placeholder rules are not eligible for calculation. No fee percentage, comparable, sold listing, or AI estimate is fabricated by this phase.

## Tests

`backend/tests/app.test.ts` uses injected service test doubles to exercise the HTTP contract deterministically without mutating the local database. `backend/tests/phase6.test.ts` covers magic-byte validation, upload limits, structured Gemini parsing, safe error mapping, and explicit mock mode. The Playwright suite covers authenticated upload/removal, mock identification, and failed-scan retry UI against local Supabase Storage.

The Supabase database and RLS tests remain live pgTAP tests under `supabase/tests/` and were rerun after the atomic sales migration. The backend tests do not mock the Supabase client itself; they replace the repository/service boundary for HTTP isolation.
## Phase 7 pricing

Price estimation is isolated in `backend/src/services/pricing/service.ts`. It accepts only the
user-confirmed item after `review_status=reviewed`, sanitizes free text, calls the Gemini adapter,
validates ordered positive prices and requested currency, and persists model/source/prompt metadata.
The Gemini service supports a real Google Gen AI adapter and an explicit mock adapter. The mock is
used when `GEMINI_MOCK=true` or credentials are absent and is labelled in every response.

`MarketDataProvider` is an adapter boundary. The current implementation is
`NotConfiguredMarketDataProvider`, so the UI reports market data as `not connected`; no marketplace
is scraped and no live data is claimed. Fee calculations use only verified database rules, or an
explicit user-entered percentage marked unverified.

## Phase 8 listing generation

Listing generation is isolated in `backend/src/services/listings.ts` and the Gemini adapter. It
resolves either an owner-scoped inventory item or a confirmed identified item, requires
`review_status=reviewed`, and uses only confirmed fields plus the latest estimate or an explicit
edited price. Generation is deliberately unsaved; the user reviews and edits the result before
`POST /listings` persists it. Prompt notes are length-limited and sanitized, and the prompt treats
all text as data rather than instructions.

Marketplace title limits are stored on the reference marketplace row. The listing parser rejects
malformed output, unsupported claims are prohibited by the prompt, and the returned price must
exactly match the estimate or user-entered price. The mock adapter is explicit in the API and UI.
Saved drafts create owner-scoped audit events. Delete is a soft archive, and there is no publish
endpoint or marketplace publishing integration.
