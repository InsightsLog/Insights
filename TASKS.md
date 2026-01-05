# Tasks — Macro Calendar L0 (Archive)

> Current work is tracked in [TASKS_L1.md](TASKS_L1.md). This file remains for historical context of the L0 launch.

## 0) Repo + tooling
- [X] T001 Add docs: SPEC.md, AGENTS.md, ROADMAP.md, TASKS.md, CHANGELOG.md
  - Test: verify files exist in repo root

- [X] T002 Add PR template + issue templates
  - Test: GitHub shows templates when creating PR/issue

## 1) Supabase setup
- [X] T010 Create Supabase tables (indicators, releases) + indexes
  - Test: tables exist, indexes exist, simple insert works in SQL editor

- [X] T011 Add env loader (src/lib/env.ts) and Supabase client (server/client)
  - Test: app boots locally; env missing throws clear error

## 2) Calendar page
- [X] T020 Build "/" route with basic table layout (static placeholder)
  - Test: page loads, shows placeholder rows

- [X] T021 Implement server query: releases in next 7 days joined with indicators
  - Test: seed DB; page shows real rows ordered by release_at

- [X] T022 Add filters: country_code + category
  - Test: selecting filters changes results

- [X] T023 Add search: indicator_name contains query (case-insensitive)
  - Test: search term reduces results correctly

- [X] T024 Fix table columns to match SPEC: show actual, forecast, previous, revised separately
  - Test: released rows show actual value distinctly; revised column visible when data exists

- [X] T025 Bug: Add `revised` to Supabase query in page.tsx
  - The select clause is missing `revised,` so the column always shows "—"
  - Fix: add `revised,` after `previous,` in the `.select()` call
  - Test: seed a release with a revised value; verify it displays in the Revised column

## 3) Indicator detail
- [X] T030 Add "/indicator/[id]" page scaffold
  - Test: page loads and shows indicator header

- [X] T031 Query historical releases for indicator (limit 200, desc)
  - Test: shows most recent releases first

## 4) Admin upload
- [X] T040 Add "/admin/upload" page (simple form)
  - Test: page renders upload form

- [X] T041 Implement POST route handler to accept CSV, validate with zod, parse safely
  - Test: upload valid CSV inserts rows; invalid CSV returns readable error

- [X] T042 Protect admin upload with ADMIN_UPLOAD_SECRET
  - Test: wrong/absent secret blocks access

## 5) Polish + deploy
- [X] T050 Add empty states + loading states
  - Test: no results shows friendly message

- [X] T051 Add basic SEO/meta + favicon/title
  - Test: page titles correct

- [ ] T052 Vercel deploy checklist in README
  - Test: deploy succeeds, env vars set, DB connected
