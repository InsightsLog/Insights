# Quality & Audit Tasks — Section 6 (add to TASKS.md)

From AUDIT_REPORT.md — High-priority findings requiring agent attention:

## 6) Quality & audit fixes

- [X] T060 Update layout.tsx metadata + expand root README
  - Fix: Replace placeholder "Create Next App" title with "Macro Calendar"
  - Fix: Expand root README with project overview, structure, quick start
  - Test: Title appears in browser tab; README explains project purpose
  - Effort: 2-4 hours

- [X] T061 Add error boundaries + graceful error handling for DB failures
  - Fix: Return error state instead of silent empty array when Supabase query fails
  - Add: Toast/modal error message for user feedback
  - Test: Kill DB connection, verify user sees "Unable to load calendar" message instead of blank table
  - Files: src/app/page.tsx, CalendarFilters
  - Effort: 4-8 hours

- [ ] T062 Set up CI/CD pipeline (.github/workflows/ci.yml)
  - Add: GitHub Actions workflow with lint, build, npm audit jobs
  - Require: PR checks before merge
  - Test: PR requires passing checks before merge
  - Reference: AUDIT_REPORT.md §7, "CI/CD Pipeline"
  - Effort: 4-6 hours

- [ ] T063 Add Zod validation for Supabase responses
  - Fix: Validate all Supabase responses with Zod schemas (not just type casts)
  - Test: Malformed response caught at runtime with clear error
  - Files: src/app/page.tsx (getUpcomingReleases, getFilterOptions)
  - Effort: 4-6 hours

- [ ] T064 Create DEPLOY.md with Vercel checklist
  - Add: Step-by-step deployment instructions
  - Add: Env var setup, secret rotation, monitoring tips
  - Test: New developer can deploy following instructions
  - Effort: 2-3 hours

- [ ] T065 Add inline comments for security & timezone clarity
  - Fix: Comment on ilike() calls explaining parameterized query safety
  - Fix: Document timezone assumptions in formatReleaseTime()
  - Reference: AUDIT_REPORT.md §2, code quality issues
  - Effort: 1-2 hours

---

**Instructions:** Copy these tasks into TASKS.md Section 6 when ready to assign to another agent.
**Priority:** High — These are blocking for L0 release.
**Total effort:** ~18-29 hours (can be parallelized with L0 feature tasks T030-T052).
