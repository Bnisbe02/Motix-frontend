# MOTIX Frontend

React + TypeScript + Vite frontend for MOTIX, exported from Bolt.

## Stack

- **Vite 5** + **React 18** + **TypeScript**
- **Tailwind CSS** for styling
- **Supabase** (Auth + Postgres) via `@supabase/supabase-js`
- **React Router 7**, **Recharts**, **lucide-react**
- Supabase Edge Functions and SQL migrations live under `supabase/`

## Environment variables

Copy `.env.example` to `.env` and fill in real values. All variables are read
via `import.meta.env` and must be prefixed `VITE_` to reach the browser bundle.

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Supabase project URL (`src/lib/supabase.ts`) |
| `VITE_SUPABASE_ANON_KEY` | yes | Supabase anon (public) key. Safe for the client; never put a `service_role` key here. |
| `VITE_CLIENT_TOKEN` | for reports | Auth token for the OVH backend report API (`src/hooks/useSpotReport.ts`, sent as `X-Client-Token`) |
| `VITE_ALLOWED_EMAILS` | no | Comma-separated email allowlist for the pilot stage; empty allows all authenticated users |

Server-side secrets (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) are
**not** part of this repo's env — they are set as Supabase Vault secrets for the
Edge Functions (see comments in `supabase/functions/*/index.ts`).

### Edge Function secrets (contact form)

The `contact` function persists every enquiry to the `contact_submissions`
table **and** emails it to the MOTIX inbox via [Resend](https://resend.com).
Set these with `supabase secrets set KEY=value`:

| Secret | Required | Purpose |
|---|---|---|
| `RESEND_API_KEY` | yes (for email) | Resend API key. Without it enquiries are still stored, but no email is sent. |
| `CONTACT_NOTIFICATION_EMAIL` | no | Inbox that receives enquiries. Defaults to `beats@fibrecast.com.au`. |
| `CONTACT_FROM_EMAIL` | no | Verified Resend sender. Defaults to `MOTIX Website <noreply@fibrecast.com.au>` — the sending domain must be verified in Resend. |
| `ALLOWED_ORIGINS` | yes (production) | Comma-separated list of the live site origin(s), e.g. `https://motix.fibrecast.com.au`. Localhost is always allowed. Required by both `contact` and `data-request`, otherwise browser CORS blocks the form in production. |

The enquirer's address is set as the email `reply-to`, so you can reply to a
lead directly from your inbox.

## Commands

```sh
npm install        # install dependencies
npm run dev        # dev server (http://localhost:5173)
npm run build      # production build → dist/
npm run preview    # serve the production build locally
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Build output

`npm run build` writes the production bundle to **`dist/`** (Vite default).
`dist/` is gitignored — build artifacts are never committed.
