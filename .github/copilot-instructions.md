# Copilot Instructions — Macro Calendar (InsightsLog/Insights)

## What This Repo Does
A macroeconomic release calendar web app. Users track upcoming economic indicators (CPI, NFP, GDP, etc.), get alerts, manage watchlists, and access data via webhooks and REST API. Stack: Next.js 15 (App Router), Supabase (Postgres + Auth + Edge Functions), Tailwind CSS, TypeScript, Vercel.

## Repo Layout
```
macro-calendar/          # Next.js app (the main product)
  src/
    app/                 # App Router pages & server actions
      actions/           # Server actions (webhooks.ts, api-keys.ts, etc.)
      api/               # API route handlers (/api/v1/*)
      components/        # Shared UI components
      admin/             # Admin-only pages
      settings/          # User settings pages
    lib/
      supabase/          # Supabase clients (server.ts, client.ts, auth.ts)
      env.ts             # Central env var config — ALWAYS use this
      data-sources/      # Data acquisition modules (fred.ts, bls.ts, ecb.ts)
  supabase/
    migrations/          # SQL migrations (numbered 001_, 002_, etc.)
    functions/           # Deno Edge Functions
  scripts/               # Utility scripts (audit-db-permissions.mjs, etc.)
AGENTS.md                # Coding agent rules (read this)
TASKS_L4.md              # Current sprint tasks
SPEC.md                  # Full product spec
CHANGELOG.md             # Must update for every user-visible change
```

## How to Build & Test
```bash
cd macro-calendar
npm ci                   # Install deps
npm run build            # Build (must pass before PR)
npm run lint             # ESLint (must pass)
npm run test             # Vitest unit tests
npm run audit:db-permissions  # Check migration SQL grants
```

## Key Conventions
- **Env vars**: Never use `process.env.SOMETHING` directly. Add to `src/lib/env.ts` and import from there.
- **Supabase clients**: Use `createSupabaseServerClient()` in server components/actions, `createSupabaseClientClient()` in client components. Never call Supabase directly from React components.
- **Server actions**: All mutations go in `src/app/actions/`. Always validate with Zod. Always check `supabase.auth.getUser()` first.
- **Migrations**: Name as `NNN_description.sql`. Next number = check highest existing in `supabase/migrations/`. Revoke anon/authenticated on sensitive tables; grant to service_role.
- **Edge Functions**: Deno runtime. Import from `npm:` or `https://deno.land/x/`. No Node built-ins. Use `Deno.serve()`.
- **TypeScript**: Strict mode. No `any`. Validate all external data with Zod.
- **PR size**: One task per PR. Small and focused.

## Database Schema Quick Reference
Core tables: `indicators`, `releases`, `profiles`, `watchlist`, `alert_preferences`, `user_roles`, `audit_log`, `api_keys`, `request_logs`, `webhook_endpoints`, `webhook_deliveries`, `plans`, `subscriptions`, `organizations`, `organization_members`, `data_sources`, `sync_logs`

RLS is enabled on all user-facing tables. `audit_log`, `request_logs`, `data_sources`, `sync_logs` are service_role only.

## Current Focus: L4 — Data Acquisition
See `TASKS_L4.md` for the active task list. Acceptance criteria are defined there. Key principle: **never invent data or claim real-time unless actually implemented.**
