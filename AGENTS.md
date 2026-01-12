# Agent Rules

You are working in a production-bound repo. Follow these rules:

## Scope
- If asked to do something outside L3, stop and propose an issue for L4 instead.
- L3 scope: webhooks, public REST API, billing & quotas, multi-tenant admin, data export

## Workflow
- Small changes only: one task per PR.
- Before coding: restate acceptance criteria + test steps.
- After coding: list files changed + how to test + risks/edge cases.
- Update CHANGELOG.md for every user-visible change.
- When you identify an L3 improvement during work, append it to BACKLOG.md under the appropriate section.

## GitHub Issues & PRs
- Use issue templates when creating issues (Bug, Feature, Task)
- Apply appropriate labels to issues and PRs (see [GITHUB_WORKFLOW.md](GITHUB_WORKFLOW.md))
- Link PRs to issues with "Closes #123" or "Fixes #123"
- Assign issues to milestones (L2, L3) based on scope

## MCP Tools

Use MCP (Model Context Protocol) tools when available for these operations:

### GitHub MCP
- **CI failures**: Use `list_workflow_runs` and `get_job_logs` to investigate build/test failures instead of guessing.
- **PRs and issues**: Use `list_pull_requests`, `search_issues`, or `pull_request_read` to understand context.
- **Code search**: Use `search_code` for finding patterns across the codebase.

### Supabase MCP
- **Schema changes**: Use `list_tables` and `execute_sql` to verify table structure before writing migrations.
- **Documentation**: Use `search_docs` to look up Supabase features (auth, RLS, functions, etc.) before implementing.
- **Debugging**: Use `get_logs` to investigate auth, storage, or edge function errors.
- **Edge Functions**: Use for email alert triggers and webhook handling (L2 feature).

### Vercel MCP
- **Deployments**: Use `list_deployments` and `get_deployment` to check deployment status.
- **Environment**: Use `list_environment_variables` to verify env vars are configured.
- **Domains**: Use `list_project_domains` to check domain configuration.

## Coding standards
- TypeScript everywhere.
- Validate external inputs with zod.
- No "magic" environment variable usage: centralize in src/lib/env.ts.
- No direct DB calls in React components; use server actions or route handlers.
- Prefer simple, boring dependencies.

## Safety / correctness
- Never invent data sources or claim "real-time" unless implemented.
- If uncertain, choose the simplest safe default and document it.

## Definition of Done
- Lint passes
- Build passes
- Manual test steps written and verified