# Tasks — Macro Calendar L0

## 0) Repo + tooling
- [x] T001 Add docs: SPEC.md, AGENTS.md, ROADMAP.md, TASKS.md, CHANGELOG.md
  - Test: verify files exist in repo root

- [x] T002 Add PR template + issue templates
  - Test: GitHub shows templates when creating PR/issue

## 1) Supabase setup
- [ ] T010 Create Supabase tables (indicators, releases) + indexes
  - Test: tables exist, indexes exist, simple insert works in SQL editor

- [ ] T011 Add env loader (src/lib/env.ts) and Supabase client (server/client)
  - Test: app boots locally; env missing throws clear error

## 2) Calendar page
- [ ] T020 Build "/" route with basic table layout (static placeholder)
  - Test: page loads, shows placeholder rows

- [ ] T021 Implement server query: releases in next 7 days joined with indicators
  - Test: seed DB; page shows real rows ordered by release_at

- [ ] T022 Add filters: country_code + category
  - Test: selecting filters changes results

- [ ] T023 Add search: indicator_name contains query (case-insensitive)
  - Test: search term reduces results correctly

## 3) Indicator detail
- [ ] T030 Add "/indicator/[id]" page scaffold
  - Test: page loads and shows indicator header

- [ ] T031 Query historical releases for indicator (limit 200, desc)
  - Test: shows most recent releases first

## 4) Admin upload
- [ ] T040 Add "/admin/upload" page (simple form)
  - Test: page renders upload form

- [ ] T041 Implement POST route handler to accept CSV, validate with zod, parse safely
  - Test: upload valid CSV inserts rows; invalid CSV returns readable error

- [ ] T042 Protect admin upload with ADMIN_UPLOAD_SECRET
  - Test: wrong/absent secret blocks access

## 5) Polish + deploy
- [ ] T050 Add empty states + loading states
  - Test: no results shows friendly message

- [ ] T051 Add basic SEO/meta + favicon/title
  - Test: page titles correct

- [ ] T052 Vercel deploy checklist in README
  - Test: deploy succeeds, env vars set, DB connected
