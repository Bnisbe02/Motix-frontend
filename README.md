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
table **and** emails it to the MOTIX inbox over SMTP (using your own mailbox —
no third-party email service). Set these with `supabase secrets set KEY=value`:

| Secret | Required | Purpose |
|---|---|---|
| `SMTP_HOST` | yes (for email) | SMTP server, e.g. `smtp.gmail.com` (Google Workspace), `smtp.office365.com` (Microsoft 365), or your host's mail server. |
| `SMTP_PORT` | no | `465` for implicit TLS (default) or `587` for STARTTLS. |
| `SMTP_USER` | yes (for email) | Full mailbox / SMTP login. |
| `SMTP_PASS` | yes (for email) | App password (recommended) or mailbox password. |
| `SMTP_TLS` | no | `true` (default, for port 465). Set `false` when using port 587/STARTTLS. |
| `CONTACT_NOTIFICATION_EMAIL` | no | Inbox that receives enquiries. Defaults to `beats@fibrecast.com.au`. |
| `CONTACT_FROM_EMAIL` | no | Envelope `from` address. Defaults to `SMTP_USER`. Most providers require it to match the authenticated account. |
| `ALLOWED_ORIGINS` | yes (production) | Comma-separated list of the live site origin(s), e.g. `https://motix.fibrecast.com.au`. Localhost is always allowed. Required by both `contact` and `data-request`, otherwise browser CORS blocks the form in production. |

Without the SMTP secrets, enquiries are still stored in the database; only the
email notification is skipped (and the failure is logged). The enquirer's
address is set as the email `reply-to`, so you can reply to a lead directly
from your inbox.

**Google Workspace / Gmail note:** generate an [App Password](https://myaccount.google.com/apppasswords)
(requires 2-Step Verification) and use it as `SMTP_PASS` with
`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`.

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
