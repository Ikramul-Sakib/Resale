# ResaleIQ

ResaleIQ is an AI-assisted resale research, valuation, and inventory workspace. It is not
an e-commerce marketplace.

## Local development

Prerequisites:

- Node.js 20+
- Docker Desktop (required by the local Supabase stack)
- Supabase CLI

Install dependencies and start local Supabase:

```bash
npm install
supabase start
supabase db reset
```

Copy `.env.example` to `.env` and fill the local values. The browser may receive only
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; keep `SUPABASE_SERVICE_ROLE_KEY` and any
Gemini key server-only. Set `GEMINI_MODEL` explicitly whenever `GEMINI_API_KEY` is set; the
backend has no guessed model default. Set `GEMINI_MOCK=true` for local/E2E identification
without making a Gemini call. Local confirmation and password-reset emails are available in
Mailpit at http://127.0.0.1:54324.

Start the API and frontend in separate terminals:

```bash
npm run dev --workspace backend
npm run dev --workspace frontend
```

The frontend is at http://127.0.0.1:5173 and the API health check is at
http://127.0.0.1:4000/health. Set `VITE_DEMO_MODE=true` only when intentionally viewing the
approved mock-data screens. Authenticated users should use `VITE_DEMO_MODE=false`.

## Authentication flow

1. Open `/register`, create an account, and read the confirmation email in Mailpit.
2. Follow the link, then sign in at `/login`.
3. The dashboard and settings use the authenticated profile and API session.
4. Use the avatar menu to open Settings or log out.
5. Use `/forgot-password` to request a reset email; the email opens `/reset-password`.

Useful checks:

```bash
npm run typecheck --workspace frontend
npm run build --workspace frontend
npm run test --workspace frontend
npm run test:e2e --workspace frontend
npm run typecheck:backend
npm run lint:backend
npm run test:backend
```

E2E authentication tests require local values from `supabase status -o env`, including the
server-only service-role key in the test process. They never expose that key to the browser.

## Real Gemini smoke test

With `GEMINI_API_KEY` and `GEMINI_MODEL` set in the backend environment, and
`GEMINI_MOCK=false`, run:

```bash
npm run gemini:smoke --workspace backend -- ../docs/design/01-dashboard.png
```

This sends one image to Gemini through the backend adapter and prints only the structured
identification result. It does not estimate price or generate listing text.

For an end-to-end upload with the explicit mock adapter:

```bash
GEMINI_MOCK=true npm run test:e2e --workspace frontend

## Listing generation

The Listing Generator creates editable drafts from confirmed item data. Drafts are for you to copy
into a marketplace; ResaleIQ does not publish listings. Generation is unsaved until you select
Save draft, and saved drafts create an audit event. Set `GEMINI_MOCK=true` for local/E2E work.

For one real Gemini listing call, create a JSON file in `backend/confirmed-item.json` containing
confirmed item fields, then run:

```bash
npm run gemini:listing-smoke --workspace backend -- ./confirmed-item.json
```

The real listing smoke command is manual and is not part of the automated test suite.
```
### Price estimation

Phase 7 adds the authenticated pricing flow. Set `GEMINI_MOCK=true` for local automated tests and
development without a Gemini call. For a real estimate, set `GEMINI_API_KEY` and a current image-capable
`GEMINI_MODEL` in the backend environment; the key never belongs in the frontend. The manual real-call
smoke command is:

```bash
npm run gemini:price-smoke --workspace backend -- ./confirmed-item.json
```

The item must be user-confirmed before estimating. Prices are AI preliminary estimates only; live
marketplace data is not connected. Fee rules show their source and verification timestamp, or are
explicitly marked unverified when the user enters a percentage.
