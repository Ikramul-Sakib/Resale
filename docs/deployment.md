# ResaleIQ deployment

This project has a static Vite frontend, a Node/Express API, and a hosted Supabase project. It is
not an e-commerce marketplace and does not publish listings externally.

## Pre-deployment requirements

- Node.js 20 or newer
- A hosted Supabase project
- A Node host that supports long-running HTTPS services
- Static hosting for the Vite output
- A Google Gemini API key and an explicitly selected image-capable model, if real AI is enabled
- A production domain with HTTPS

## Supabase

1. Create a hosted Supabase project and keep the project URL, anon key, and service-role key
   private in their intended environments.
2. Link the local project and push migrations:

   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   ```

3. Confirm the private `product-images` bucket and its owner-prefix policies exist. Do not make the
   bucket public.
4. In Supabase Auth URL configuration, set the production site URL and add the exact frontend
   callback URL, for example `https://app.example.com` and
   `https://app.example.com/reset-password`.
5. Configure production email delivery. Local Mailpit is for development only.
6. Verify RLS and Storage policies with the SQL tests against a non-production staging project
   before applying production data changes.

## Backend

Build and run the API on a Node host:

```bash
npm ci
npm run build --workspace backend
npm run start --workspace backend
```

Set these backend-only variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CORS_ORIGIN=https://app.example.com
PORT
JSON_BODY_LIMIT
RATE_LIMIT_WINDOW_MS
RATE_LIMIT_MAX
GEMINI_API_KEY              # optional; omit to use the labelled mock adapter
GEMINI_MODEL                # required with GEMINI_API_KEY
GEMINI_TIMEOUT_MS
GEMINI_MAX_RETRIES
GEMINI_MOCK=false           # true only for controlled development/test environments
```

Expose only `/health` and `/api/v1` through the HTTPS reverse proxy. Never put the service-role
key or Gemini key in frontend environment variables.

## Frontend

Build the static site:

```bash
npm ci
npm run build --workspace frontend
```

Publish `frontend/dist` to the static host and configure SPA fallback to `index.html`. Set only:

```text
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<public-anon-key>
VITE_API_BASE_URL=https://api.example.com/api/v1
VITE_DEMO_MODE=false
```

Set the API CORS allowlist to the exact frontend origin, including scheme and host. Do not use `*`
with authenticated requests.

## Pre-launch checklist

- [ ] HTTPS is enabled for frontend, API, and Supabase callbacks.
- [ ] Production Auth redirect URLs are exact and tested.
- [ ] Email confirmation and password reset emails arrive through production SMTP.
- [ ] `VITE_DEMO_MODE=false`.
- [ ] No service-role or Gemini key exists in the frontend bundle.
- [ ] Private Storage bucket and owner-prefix policies are verified.
- [ ] RLS is enabled on every user-data table.
- [ ] CORS contains only approved frontend origins.
- [ ] Rate limits and JSON/upload limits are configured for expected traffic.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build:all`, `npm run test`, and staging DB/E2E tests pass.
- [ ] Backups and restore procedures have been tested.
- [ ] Logs and alerts do not collect tokens, passwords, prompts, or image contents.

## Backups and key rotation

Use Supabase's managed backup/PITR options and periodically perform a restore rehearsal. Rotate the
service-role and Gemini keys through their providers, update the backend secret store, restart the
API, and invalidate the old key. Rotate the anon key only with a coordinated frontend rebuild and
Supabase Auth configuration update. Never commit replacement keys to Git.

## Known limitations

- AI prices are preliminary estimates, not verified or guaranteed.
- Live market data is not connected; the resale-index endpoint remains `501`.
- ResaleIQ does not publish listings to marketplaces.
- Account deletion is not exposed until safe server-side cleanup is implemented.
- Workspace-wide npm audit currently reports high-severity development-tool advisories with only a
  breaking-version fix available; production dependency audits are clean.
