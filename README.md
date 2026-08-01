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
