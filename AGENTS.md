# Agent Rules

You are working in a production-bound repo. Follow these rules:

## Scope
- If asked to do something outside L2, stop and propose an issue for L3 instead.
- L2 scope: email alerts, role-based admin, rate limiting, revision tracking

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

## MCP Tools (MANDATORY)

You MUST use MCP (Model Context Protocol) tools for these operations. Do not skip them:

### GitHub MCP - REQUIRED for:
- **Before any CI/build fix**: Run `list_workflow_runs` + `get_job_logs` FIRST
- **Before working on issue/PR**: Run `search_issues` or `pull_request_read` FIRST
- **Finding existing patterns**: Use `search_code` before implementing similar features
- **Never guess CI failures** - always check logs with MCP tools

### Supabase MCP - REQUIRED for:
- **Before creating migrations**: Run `list_tables` to verify current schema
- **Before implementing auth/RLS/functions**: Run `search_docs` for Supabase best practices
- **When debugging auth/DB errors**: Run `get_logs` FIRST before guessing
- **Schema verification**: Use `execute_sql` (read-only) to check table structure

### Vercel MCP - REQUIRED for:
- **Before deployment troubleshooting**: Run `list_deployments` + `get_deployment` FIRST
- **Before adding env vars**: Run `list_environment_variables` to check current state
- **Domain issues**: Run `list_project_domains` before making changes

### Context7 MCP - REQUIRED for:
- **Before using library APIs**: Run `resolve-library-id` then `get-library-docs` for Next.js, React, Supabase, Zod, etc.
- **When implementing new features**: Check official docs via Context7 instead of guessing API signatures
- **For best practices**: Use `mode='info'` for guides, `mode='code'` for API examples
- **Pagination**: If docs insufficient, try `page=2`, `page=3`, etc. with same topic

**Rule**: If you start working on CI/deployment/schema/library features without checking MCP tools first, STOP and use the tools.

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