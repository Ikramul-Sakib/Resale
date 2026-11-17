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
    ├── middleware/           # auth, request IDs, validation, errors
    ├── repositories/         # Supabase data access and owner filters
    ├── validators/            # strict Zod request schemas
    ├── types/                # request and domain types
    └── utils/                # errors and pagination helpers
```

## Configuration and secrets

`src/config/env.ts` loads `.env` and validates it with Zod before the server starts. Missing or invalid values produce a clear startup error. `SUPABASE_SERVICE_ROLE_KEY` is only read by `backend/src/config/supabase.ts`; it is never sent to a browser response.

`CORS_ORIGIN` is a comma-separated allowlist. The API rejects disallowed origins, applies Helmet, limits JSON body size, attaches an `X-Request-ID`, and rate-limits requests.

## Authentication and ownership

Protected routes require a Supabase bearer token. The auth middleware calls Supabase `auth.getUser(token)` and attaches only the verified user ID to the request. Controllers never read `user_id` from the body or query string.

Every user-owned repository method accepts `userId` separately and applies an owner filter. A missing owner-scoped row returns a generic 404, preventing cross-user existence leaks. Database RLS remains the final ownership boundary.

## Database access

The backend uses the Supabase service-role client only on the server. The service role is necessary for the trusted API repository layer, while the API itself enforces the verified user ID in every query.

The sales repository calls the Phase 4 `record_sale` PostgreSQL function. That function updates the owner-scoped inventory item and inserts the sales row in one transaction. Its execute privilege is restricted to `service_role`; the backend supplies the user ID derived from the verified token.

Fee calculation reads configurable, verified database rules and returns provenance. Placeholder rules are not eligible for calculation. No fee percentage, comparable, sold listing, or AI estimate is fabricated by this phase.

## Tests

`backend/tests/app.test.ts` uses injected service test doubles to exercise the HTTP contract deterministically without mutating the local database. It covers authentication, strict input validation, ownership isolation, CRUD, sales status flow, fee provenance, analytics, stub behavior, and error shape.

The Supabase database and RLS tests remain live pgTAP tests under `supabase/tests/` and were rerun after the atomic sales migration. The backend tests do not mock the Supabase client itself; they replace the repository/service boundary for HTTP isolation.
