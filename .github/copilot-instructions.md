# Copilot Coding Agent Instructions

> Trust these instructions. Only search if information is missing or in error.

## Repository Summary

**Insights** is a **macroeconomic release calendar** web application. Users can browse upcoming economic releases, sign in via magic-link, save indicators to watchlists, and receive email alerts. The app has role-based admin access and audit logging.

| Property | Value |
|----------|-------|
| Type | Monorepo with single Next.js app |
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript (strict mode) |
| Database | Supabase (PostgreSQL with RLS) |
| Styling | Tailwind CSS 4 |
| Validation | Zod |
| Testing | Vitest |
| Deployment | Vercel |
| Node.js | 20+ (CI uses 20, dev container uses 24) |

## Project Layout

```
Insights/
├── .github/              # CI workflows, issue templates, PR template
│   └── workflows/ci.yml  # Lint, build, audit on push/PR to main
├── macro-calendar/       # ← MAIN APP (all code changes go here)
│   ├── src/
│   │   ├── app/          # Next.js App Router pages and components
│   │   │   ├── actions/  # Server actions (alerts.ts, watchlist.ts)
│   │   │   ├── components/ # Shared React components
│   │   │   └── api/      # Route handlers
│   │   └── lib/          # Utilities
│   │       ├── env.ts    # Centralized env validation (REQUIRED)
│   │       └── supabase/ # Supabase clients (server.ts, client.ts, auth.ts)
│   ├── supabase/
│   │   ├── migrations/   # SQL migrations (run in order: 001_, 002_, etc.)
│   │   └── functions/    # Edge Functions (Deno runtime)
│   ├── package.json      # npm scripts
│   ├── tsconfig.json     # TypeScript config
│   ├── eslint.config.mjs # ESLint config (flat config format)
│   └── vitest.config.ts  # Test config
├── AGENTS.md             # Agent rules (MUST READ for coding standards)
├── SPEC.md               # Product specification (L2 scope)
├── TASKS_L2.md           # Current task list
├── CHANGELOG.md          # Update for user-visible changes
├── BACKLOG.md            # L3+ ideas (append here for out-of-scope items)
└── DEPLOY.md             # Deployment guide
```

## Build Commands

**All commands must be run from `/workspaces/Insights/macro-calendar`.**

### Install Dependencies (ALWAYS run first)
```bash
cd /workspaces/Insights/macro-calendar
npm ci
```
> Uses `package-lock.json`. Takes ~20-25 seconds.

### Lint
```bash
npm run lint
```
> ESLint with Next.js config. Must pass before merge.

### Test
```bash
npm run test
```
> Vitest runs all `*.test.ts` files. ~1-2 seconds. Expect some stderr output from error-case tests (this is normal).

### Build
```bash
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key \
npm run build
```
> **CRITICAL**: Build requires env vars or it fails. Use placeholders for CI/validation. Takes ~15-20 seconds.

### Full Validation Sequence
```bash
cd /workspaces/Insights/macro-calendar
npm ci
npm run lint
npm run test
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key \
npm run build
```

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main`:

1. **Lint** - `npm ci` then `npm run lint`
2. **Build** - `npm ci` then `npm run build` (with placeholder env vars)
3. **Audit** - `npm audit --audit-level=high`

All three jobs must pass. Build uses Node.js 20.

## Coding Standards (from AGENTS.md)

1. **TypeScript everywhere** - No `.js` files
2. **Validate inputs with Zod** - All external data
3. **Centralize env vars in `src/lib/env.ts`** - Never access `process.env` directly elsewhere
4. **No DB calls in React components** - Use server actions or route handlers
5. **Small PRs** - One task per PR
6. **Update CHANGELOG.md** - For every user-visible change
7. **Link PRs to issues** - Use "Closes #123" or "Fixes #123"

## Key Patterns

### Environment Variables
```typescript
// ✅ Correct - use centralized env
import { env } from "@/lib/env";
import { getServerEnv } from "@/lib/env";

// ❌ Wrong - never do this
process.env.NEXT_PUBLIC_SUPABASE_URL
```

### Supabase Clients
```typescript
// Server Components / Actions / Route Handlers
import { createSupabaseServerClient } from '@/lib/supabase/server';
const supabase = await createSupabaseServerClient();

// Client Components
import { createSupabaseClient } from '@/lib/supabase/client';
const supabase = createSupabaseClient();

// Service role (admin operations, bypasses RLS)
import { createSupabaseServiceClient } from '@/lib/supabase/service-role';
```

### Path Alias
```typescript
import { something } from "@/lib/something"; // Maps to ./src/*
```

## Database Migrations

Migrations are in `macro-calendar/supabase/migrations/`. Run in order:
1. `001_create_tables.sql` - indicators, releases
2. `002_create_profiles.sql` - profiles, auth triggers
3. `003_create_watchlist.sql` - watchlist with RLS
4. `004_create_alert_preferences.sql` - alert preferences with RLS
5. `005_create_release_alert_webhook.sql` - webhook trigger
6. `006_create_user_roles.sql` - admin roles with RLS
7. `007_create_audit_log.sql` - audit logging

Test files (`*_test_*.sql`) are for verification only.

## Testing

- Test files: `*.test.ts` next to source files
- Framework: Vitest
- Run single test file: `npm run test -- src/lib/csv-parser.test.ts`
- Watch mode: `npm run test:watch`

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `NEXT_PUBLIC_SUPABASE_URL must be a valid URL` | Missing env vars | Set placeholder env vars for build |
| `eslint: not found` | Dependencies not installed | Run `npm ci` first |
| `Cannot find module '@/...'` | Path alias issue | Check tsconfig.json paths |
| Build fails with env errors | env.ts validates at import | Use placeholders or set real values |

## Files to Update

| Change Type | Update These Files |
|-------------|-------------------|
| New feature | Source files + `CHANGELOG.md` |
| DB schema change | New migration file in `supabase/migrations/` |
| New env var | `src/lib/env.ts` + `DEPLOY.md` |
| Bug fix | Source files + `CHANGELOG.md` |
| Out-of-scope idea | Append to `BACKLOG.md` |

## MCP Tools (MANDATORY)

**You MUST use MCP tools before starting work in these areas:**

### GitHub MCP - Use FIRST for:
- **CI/build failures** → `list_workflow_runs` + `get_job_logs`
- **Issue/PR context** → `search_issues` or `pull_request_read`
- **Code patterns** → `search_code` before implementing

### Supabase MCP - Use FIRST for:
- **Migration work** → `list_tables` to verify schema
- **Auth/RLS/Functions** → `search_docs` for Supabase docs
- **Database errors** → `get_logs` for diagnostics
- **Schema checks** → `execute_sql` (SELECT only)

### Vercel MCP - Use FIRST for:
- **Deployment issues** → `list_deployments` + `get_deployment`
- **Env var changes** → `list_environment_variables`
- **Domain config** → `list_project_domains`

### Context7 (Library Docs) - Use FIRST for:
- **Next.js features** → `resolve-library-id` "next.js" then `get-library-docs`
- **Supabase APIs** → Lookup auth, RLS, functions, storage patterns
- **React patterns** → Server Components, hooks, best practices
- **Zod validation** → Schema patterns and API examples
- **Any library usage** → Always check official docs before implementing

**Rule**: Never guess about CI failures, schema, deployments, or library APIs. Check MCP tools first.

## Definition of Done

Before marking a task complete:
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm run test`)
- [ ] Build passes (with placeholder env vars)
- [ ] CHANGELOG.md updated (if user-visible)
- [ ] PR linked to issue with "Closes #X"
