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
future Gemini key server-only. Local confirmation and password-reset emails are available in
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
