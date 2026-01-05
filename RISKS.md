# Risks — Macro Calendar

This document tracks known risks, technical debt, and edge cases for the current L1 scope.

---

## High Priority

### 1. No Automated Test Coverage
- **Impact:** Auth flows, watchlist actions, and CSV parsing could regress unnoticed.
- **Affected:** Auth middleware/helpers, watchlist server actions, CSV parsing in [macro-calendar/src/app/api/admin/upload/route.ts](macro-calendar/src/app/api/admin/upload/route.ts), Zod schemas.
- **Mitigation:** Add unit/integration tests for auth/watchlist and CSV parsing (T091) and wire into CI.
- **Status:** Open

### 2. Watchlist/Auth RLS Not Verified End-to-End
- **Impact:** Misconfigured policies or missing middleware could expose or break per-user data.
- **Affected:** `profiles` and `watchlist` tables, server actions, `/watchlist` page, auth callback flow.
- **Mitigation:** Add auth middleware (T101), helper utilities (T102), and manual RLS verification for watchlist/profile tables.
- **Status:** Open

### 3. N+1 Query Pattern in Admin Upload
- **Impact:** Large CSV uploads (100+ rows) can exceed serverless timeouts and slow deployments.
- **Affected:** [macro-calendar/src/app/api/admin/upload/route.ts](macro-calendar/src/app/api/admin/upload/route.ts) — per-row inserts/updates.
- **Mitigation:** Refactor to batched upserts/inserts (T092); add load test for 100-row CSV.
- **Status:** Open

---

## Medium Priority

### 4. Admin Upload Secret Transmitted in Form Data
- **Impact:** Secret visible in network tab; could be logged by proxies.
- **Affected:** [macro-calendar/src/app/admin/upload/page.tsx](macro-calendar/src/app/admin/upload/page.tsx) form submission.
- **Mitigation:** Move secret to header or replace with authenticated admin role in L2.
- **Status:** Accepted until role-based admin exists.

### 5. No Rate Limiting on Public/Authed Endpoints
- **Impact:** Calendar, indicator, and watchlist endpoints could be scraped or abused.
- **Affected:** `/`, `/indicator/[id]`, watchlist server actions.
- **Mitigation:** Add rate limiting via middleware or Supabase edge functions in L2.
- **Status:** Deferred

### 6. Timezone Display Assumptions
- **Impact:** Release times show in browser timezone with no override option.
- **Affected:** `formatReleaseTime()` in [macro-calendar/src/app/page.tsx](macro-calendar/src/app/page.tsx).
- **Mitigation:** Document behavior; add timezone selector in L2.
- **Status:** Documented

---

## Low Priority

### 7. Empty `src/app/actions/` Directory
- **Impact:** Minor confusion for new developers.
- **Mitigation:** Delete folder or add placeholder README (T093).
- **Status:** Open

### 8. Inner README.md is Boilerplate
- **Impact:** Developers opening `macro-calendar/` directly see default Next.js docs.
- **Affected:** [macro-calendar/README.md](macro-calendar/README.md).
- **Mitigation:** Replace with project-specific content or redirect to root (T094).
- **Status:** Open

---

## Resolved

- RLS policies are included in migrations for public tables (T090).

---

## Review Schedule

- **Before each deployment:** Review High Priority items
- **Monthly:** Review Medium Priority items for promotion
- **Quarterly:** Full risk register review

---

_Last updated: 2026-01-05_
