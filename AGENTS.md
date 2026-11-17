# ResaleIQ: Agent Instructions

You are a senior full-stack engineer building ResaleIQ, an AI-powered resale research,
valuation and inventory SaaS. It is NOT an e-commerce marketplace.

## Stack (mandatory, no substitutions)
- Frontend: HTML5, CSS3, Vanilla JS + TypeScript, Vite. NO React/Vue/Next/Angular.
- Backend: Node.js, Express, TypeScript, REST under /api/v1.
- Data: Supabase (PostgreSQL, Auth, private Storage).
- AI: Google Gemini via the official Google Gen AI SDK, backend only.
- Libraries: Zod, Lucide icons, Chart.js, Vitest, Playwright.

## Design source of truth
- Reference images: docs/design/*.png (PDF: docs/design/ResaleIQ-UI.pdf). View them before any UI work.
- Reproduce the approved UI closely; do not redesign. Responsiveness and a11y improvements are allowed.
- Design tokens (approximate, verify against the images):
  - Font: Inter. Page bg #F6F7F9, cards white, radius ~16px, soft 1px border, light shadow.
  - Primary: indigo (~#4F46E5). Active nav item: light indigo bg (~#EEEBFD) with indigo bold text.
  - Left sidebar: logo (indigo rounded square + "ResaleIQ"), 9 items: Dashboard, Scan Product,
    My Inventory, Saved Scans, Listing Generator, Price Guides, Fee Calculator, Analytics, Settings.
  - Top bar: search input ("Search scans, items, listings") and a circular initials avatar.
  - Primary button: solid indigo; secondary: white with grey border.
  - "Demo data" amber pill appears only in demo mode, never for real user data.
  - Scan page: dashed indigo drop zone; Estimate page: 3 cards, the middle (typical) highlighted with an indigo border.

## Screens
1. Dashboard: 5 stat cards, Recent scans, Inventory overview (progress bars), Recent activity.
2. Scan Product: drag-drop zone (JPG/PNG/WebP, max 10 MB, max 6 images), Upload + Use camera, previews with remove,
   Analysis status (Upload, Gemini identifying, Extracting attributes), "Identify & Estimate Price".
3. Identification results: photo + editable fields (name, brand, model, category, condition, key attributes),
   confidence note, "Continue to Price Estimation". Never assume the AI is right.
4. Price estimate: currency selector, low/typical/high cards, range bar, suggested price, fees, net earnings,
   factors, "How this was estimated", last updated, Generate Listing, Save to Inventory.
Plus: My Inventory, Saved Scans, Listing Generator, Price Guides, Fee Calculator, Analytics, Settings,
all in the same design system, with working buttons only (no decorative controls).

## Non-negotiable rules
- Never expose GEMINI_API_KEY or the Supabase service-role key to the browser.
- Never hardcode the PDF's sample prices/stats as real results. Demo data only in a clearly labelled demo mode.
- Gemini prices are "AI preliminary estimates". State that live market data was NOT used.
  Do not fabricate comparables, sold listings, confidence scores, or marketplace fee percentages.
  Fee rules are configurable data with source + verified_at. No scraping. Market data via adapter interfaces only.
- Do not claim to publish to external marketplaces.
- Validate all inputs and all Gemini JSON output with Zod. Never trust a client-supplied user_id.
- Verify Supabase JWT in Express. RLS on every user table using auth.uid(). Private storage buckets.
- Helmet, CORS allowlist, rate limiting, no stack traces or secrets in responses.
- DB: UUID PKs, FKs, indexes, created_at/updated_at, NUMERIC money + currency column, JSONB attributes,
  CHECK(low <= typical <= high). Use migrations + seed.sql. No passwords in app tables.
- If credentials are missing, build a safe mock adapter and say so clearly. Never pretend a service is connected.
- Never claim tests passed unless you actually ran them and saw the output.

## API (prefix /api/v1)
auth/me; scans (POST, GET, GET :id, POST :id/retry); items (GET/PATCH :id, POST :id/estimate);
estimates/:id; pricing/history; listings (generate, CRUD); inventory (CRUD); sales (GET, POST);
marketplaces; fees/calculate; analytics/dashboard; analytics/resale-index.
Consistent error shape, pagination, correct status codes.

## Structure
resaleiq/{frontend,backend,supabase,docs}: modular, business logic out of route handlers.
Frontend: src/{pages,components,services,styles,types,utils}. Backend: src/{routes,controllers,services/{gemini,pricing,listings},
middleware,repositories,validators,config}. Docs: architecture.md, database.md, api.md, deployment.md. Plus .env.example and README.

## Workflow
- Work one phase at a time. Inspect existing files first and reuse working code.
- After each phase: summarize what changed, list files touched, list env vars needed, run tests/build/lint, report issues.
- Do not start the next phase while the current one has critical errors.
- Phases: 1 Inspect and plan; 2 Frontend (4 screens); 3 Supabase schema/RLS/storage; 4 Express API;
  5 Auth; 6 Gemini identification; 7 Price estimation; 8 Listing generation;
  9 Inventory, scans, fees, analytics; 10 Integration, tests, docs, deployment.