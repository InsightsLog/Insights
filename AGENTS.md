# Agent Rules — Macro Calendar

You are working in a production-bound repo. Read `.github/copilot-instructions.md` first for full context.

## Scope
- Current milestone: **L4** — data acquisition, mobile app, calendar integrations, historical data API, advanced analytics.
- If asked to do something outside L4, stop and propose an issue for L5 instead.

## Workflow
- One task per PR. Small and focused.
- Before coding: restate the acceptance criteria from the issue.
- After coding: list files changed + how to test + risks/edge cases.
- Update `CHANGELOG.md` for every user-visible change.
- Link PRs to issues: "Closes #N" in the PR body.

## MCP Tools (use these — don't guess)

### GitHub MCP
- `list_workflow_runs` / `get_job_logs` — investigate CI failures before guessing at fixes.
- `list_pull_requests` / `search_issues` / `pull_request_read` — understand context.
- `search_code` — find patterns across the codebase without grepping locally.

### Supabase MCP
- `list_tables` / `execute_sql` — verify schema before writing migrations.
- `search_docs` — look up Supabase features (auth, RLS, edge functions) before implementing.
- `get_logs` — debug auth, storage, or edge function errors.

### Vercel MCP
- `list_deployments` / `get_deployment` — check deployment status after pushing.
- `list_environment_variables` — verify env vars are configured.

## Coding Standards
- TypeScript everywhere. No `any`. Strict mode.
- Validate external inputs with Zod.
- **Env vars**: always centralize in `src/lib/env.ts`. Never use `process.env.*` inline.
- No direct DB calls in React components — use server actions or route handlers.
- Prefer boring, stable dependencies.

## Safety
- Never invent data sources or claim real-time unless actually implemented.
- If uncertain, choose the simplest safe default and document it.
- RLS must be enforced for all user-facing tables.
- Service_role only for: `audit_log`, `request_logs`, `data_sources`, `sync_logs`.

## Definition of Done
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `npm run test` passes (or new tests added)
- [ ] Manual test steps written in PR description
- [ ] `CHANGELOG.md` updated (if user-visible)
