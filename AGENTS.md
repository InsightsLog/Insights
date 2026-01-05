# Agent Rules

You are working in a production-bound repo. Follow these rules:

## Scope
- If asked to do something outside L1, stop and propose an issue for L2 instead.

## Workflow
- Small changes only: one task per PR.
- Before coding: restate acceptance criteria + test steps.
- After coding: list files changed + how to test + risks/edge cases.
- Update CHANGELOG.md for every user-visible change.
- When you identify an L2 improvement during work, append it to BACKLOG.md under the appropriate section.

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