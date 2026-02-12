# CLAUDE.md

This file provides guidance for AI assistants working in the Insights repository.

## Project Overview

Insights is a public macroeconomic release calendar with authenticated watchlists, API access, and subscription billing. Users browse upcoming economic releases, sign in with magic links, save indicators to watchlists, receive alerts, and access data via REST API.

**Production URL:** https://insights-econ-watchs-projects.vercel.app

**Current status:** L3 shipped, L4 in active development.

## Repository Structure

```
Insights/                          # Root — documentation and task tracking
├── macro-calendar/                # Next.js application (all source code)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Main calendar/dashboard
│   │   │   ├── layout.tsx         # Root layout with auth + usage banner
│   │   │   ├── actions/           # Server actions (19 files including tests)
│   │   │   ├── components/        # React components (12 files)
│   │   │   ├── api/               # API routes (v1/, admin/, stripe/, export/)
│   │   │   ├── settings/          # API keys, webhooks, billing pages
│   │   │   ├── admin/             # Admin CSV upload
│   │   │   ├── org/               # Organization pages
│   │   │   ├── indicator/[id]/    # Indicator detail page
│   │   │   ├── watchlist/         # Watchlist page
│   │   │   ├── docs/api/          # API documentation page
│   │   │   └── unsubscribe/       # Email unsubscribe
│   │   ├── lib/
│   │   │   ├── env.ts             # Centralized environment validation (Zod)
│   │   │   ├── supabase/          # Supabase clients (client, server, service-role, auth)
│   │   │   ├── api/               # API utilities (auth, quota, usage, openapi)
│   │   │   ├── csv-parser.ts      # CSV parsing for data import
│   │   │   ├── ical.ts            # RFC 5545 iCal generation
│   │   │   ├── request-logger.ts  # Abuse detection logging
│   │   │   └── unsubscribe-token.ts
│   │   └── middleware.ts          # Rate limiting, session refresh, request logging
│   ├── supabase/
│   │   └── migrations/            # 38 SQL migration files (001-022)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── next.config.ts
│   └── eslint.config.mjs
├── SPEC.md                        # Product specification
├── AGENTS.md                      # Agent coding rules and standards
├── DEPLOY.md                      # Deployment guide
├── TASKS_L4.md                    # Current L4 task list
├── CHANGELOG.md                   # Release history
├── BACKLOG.md                     # Future ideas (L5+)
└── vercel.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL with RLS) |
| Auth | Supabase Auth (magic link email) |
| Payments | Stripe (subscriptions + webhooks) |
| Rate Limiting | Upstash Redis |
| Validation | Zod |
| Testing | Vitest |
| Linting | ESLint 9 (next/core-web-vitals + typescript) |
| Build Optimization | React Compiler (babel-plugin-react-compiler) |
| Deployment | Vercel (serverless) |

## Common Commands

All commands run from `macro-calendar/`:

```bash
cd macro-calendar

npm run dev          # Start dev server on localhost:3000
npm run build        # Production build
npm run lint         # Run ESLint
npm run test         # Run all tests (vitest run)
npm run test:watch   # Run tests in watch mode
```

## Architecture

### Server-Client Boundary

- **Server components** are the default. Database queries, auth checks, and billing logic stay server-side.
- **Client components** handle UI state and interactions only.
- **Server actions** (`src/app/actions/`) handle all data mutations. No direct DB calls from React components.
- **API routes** (`src/app/api/`) serve the external REST API and webhook endpoints.

### Authentication & Authorization

- Supabase Auth with magic link (email-based sign-in).
- Middleware refreshes sessions on every request via `supabase.auth.getUser()`.
- Row Level Security (RLS) enforces data isolation at the database level.
- Role-based access control: admin, member, owner.
- Service role client (`src/lib/supabase/service-role.ts`) for privileged operations only.

### API Design

- Versioned REST API at `/api/v1/` (indicators, releases, calendar).
- API key authentication for external consumers.
- Per-key quotas and rate limiting.
- OpenAPI schema at `/api/openapi`.

### Middleware Pipeline

`src/middleware.ts` handles three concerns in order:
1. **Rate limiting** — 60 req/min public, 30 req/min for data-modifying routes (via Upstash Redis).
2. **Session refresh** — Supabase token refresh on each request.
3. **Request logging** — IP + path logging for abuse detection (when `ENABLE_REQUEST_LOGGING=true`).

### Database

- Supabase PostgreSQL with 38 migration files in `supabase/migrations/`.
- RLS enabled on all user-specific tables.
- Key tables: `indicators`, `releases`, `profiles`, `watchlist`, `alert_preferences`, `api_keys`, `webhook_endpoints`, `plans`, `subscriptions`, `organizations`, `organization_members`.

## Environment Variables

All env vars are validated with Zod in `src/lib/env.ts`. Never access `process.env` directly elsewhere.

**Required (public):**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key

**Required (server):**
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `UNSUBSCRIBE_TOKEN_SECRET` — Secret for signed unsubscribe tokens

**Optional:**
- `ADMIN_UPLOAD_SECRET` — Legacy upload auth (role-based preferred)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — Rate limiting
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Billing
- `STRIPE_PRICE_{PLAN}_{INTERVAL}` — Stripe price IDs (e.g., `STRIPE_PRICE_PLUS_MONTHLY`)
- `ENABLE_REQUEST_LOGGING` — Set to `true` for abuse detection
- `CRON_SECRET` — Vercel Cron authentication

For CI builds, placeholder values for public vars are sufficient (see `.github/workflows/ci.yml`).

## Coding Standards

These extend the rules in `AGENTS.md`:

- **TypeScript everywhere.** Strict mode is enabled.
- **Validate external inputs with Zod.** All env vars, API inputs, and form data.
- **Centralize env vars** in `src/lib/env.ts`. Use `getServerEnv()`, `getRateLimitEnv()`, `getStripeEnv()`, etc.
- **No direct DB calls in components.** Use server actions or API route handlers.
- **Path alias:** Use `@/` imports (maps to `src/`). Example: `import { env } from "@/lib/env"`.
- **Prefer simple dependencies.** The project has only 9 production dependencies.

## Testing

- **Framework:** Vitest with Node environment.
- **Test files** are colocated with source: `*.test.ts` next to the file being tested.
- **Coverage areas:** Server actions, API route handlers, utility functions.
- **No E2E tests** currently in the codebase.
- **Run tests before committing:** `npm run test` from `macro-calendar/`.

## CI/CD Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on push to `main` and PRs against `main`:

1. **Lint** — `npm run lint`
2. **Build** — `npm run build` (with placeholder env vars)
3. **Security Audit** — `npm audit --audit-level=high`

Production deploys to Vercel automatically on merge to `main`.

## Workflow Rules

- **Scope:** L4 features only (data acquisition, mobile app, calendar integrations, historical API, analytics). Anything beyond L4 goes to `BACKLOG.md`.
- **Small changes:** One task per PR.
- **Before coding:** Restate acceptance criteria and test steps.
- **After coding:** List files changed, how to test, and risks/edge cases.
- **Update CHANGELOG.md** for every user-visible change.
- **Definition of Done:** Lint passes, build passes, manual test steps written and verified.

## Key Files to Read First

1. `SPEC.md` — Full product specification and data model
2. `AGENTS.md` — Coding rules and workflow standards
3. `macro-calendar/src/lib/env.ts` — Environment validation (understand all env vars)
4. `macro-calendar/src/middleware.ts` — Request pipeline (rate limiting, auth, logging)
5. `macro-calendar/src/app/page.tsx` — Main calendar UI
6. `macro-calendar/src/app/actions/watchlist.ts` — Example server action pattern
7. `macro-calendar/supabase/migrations/001_create_tables.sql` — Core schema
8. `DEPLOY.md` — Deployment and infrastructure setup

## Level-Based Feature Progression

| Level | Status | Features |
|-------|--------|----------|
| L1 | Shipped | Auth, watchlists, calendar, admin CSV upload |
| L2 | Shipped | Email alerts, role-based admin, API keys |
| L3 | Shipped | Webhooks, REST API, billing, organizations, data export |
| L4 | In Progress | Data acquisition, mobile app, calendar integrations, historical API, analytics |
| L5 | Planned | Custom alerts, ML predictions, social features, broker integrations |

## GitHub Issues & PRs

- Use issue templates (Bug, Feature, Task) from `.github/ISSUE_TEMPLATE/`.
- Apply appropriate labels.
- Link PRs to issues with `Closes #123` or `Fixes #123`.
- PR template is at `.github/pull_request_template.md`.
