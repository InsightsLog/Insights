# Tasks — Macro Calendar L1

## Audit Remediation (Priority)

- [X] T090 Add RLS policies to migration file.
  - Move RLS statements from DEPLOY.md into `supabase/migrations/001_create_tables.sql`
  - Ensures security is automatic on fresh deployments
  - Test: run migration on fresh DB; verify anon key cannot INSERT/UPDATE/DELETE

- [X] T091 Add unit tests for CSV parser
  - File: `src/app/api/admin/upload/route.test.ts`
  - Test cases: quoted fields, escaped quotes, empty fields, malformed rows
  - Framework: Vitest or Jest
  - Test: `npm test` passes

- [X] T092 Batch admin upload queries
  - Refactor [route.ts#L215-L305](macro-calendar/src/app/api/admin/upload/route.ts) to use batch inserts
  - Current: N+1 queries (2-4 DB calls per CSV row)
  - Target: 2-3 total queries regardless of row count
  - Test: upload 100-row CSV completes in <5s

- [X] T093 Delete empty `src/app/actions/` folder
  - Reduces confusion; re-add when server actions are needed
  - Test: folder does not exist

- [X] T094 Replace macro-calendar/README.md
  - Replace Next.js boilerplate with redirect to root README or project-specific docs
  - Test: README.md contains relevant project info

---

## 0) User Accounts Setup
- [X] T100 Add Supabase Auth: profiles table + RLS policies
  - Migration: profiles(id, email, display_name, created_at, updated_at)
  - RLS: users can only read/write their own profile
  - Trigger: auto-create profile on auth.users insert
  - Test: create user in Supabase dashboard; profile row appears

- [X] T101 Add auth middleware for session refresh
  - File: src/middleware.ts
  - Test: auth cookies refresh on page load

- [X] T102 Add auth helper functions (getCurrentUser, etc.)
  - File: src/lib/supabase/auth.ts
  - Test: getCurrentUser returns null when logged out, user when logged in

- [X] T103 Add auth callback route for magic link
  - Route: /auth/callback
  - Test: clicking magic link in email redirects to home logged in

## 1) Auth UI
- [X] T110 Add Header component with UserMenu
  - Components: Header.tsx, UserMenu.tsx
  - Test: header shows on all pages; shows "Sign In" when logged out

- [X] T111 Add AuthModal with magic link sign-in
  - Component: AuthModal.tsx
  - Test: clicking Sign In opens modal; entering email sends magic link

- [X] T112 Update layout.tsx to include Header
  - Test: header visible on /, /indicator/[id], /watchlist

## 2) Watchlist Feature
- [X] T120 Add watchlist table + RLS
  - Migration: watchlist(id, user_id, indicator_id, created_at)
  - Constraint: unique(user_id, indicator_id)
  - RLS: users can only CRUD their own watchlist items
  - Test: insert watchlist row; verify RLS blocks other users

- [x] T121 Add watchlist server actions
  - File: src/app/actions/watchlist.ts
  - Actions: addToWatchlist, removeFromWatchlist, toggleWatchlist
  - Test: actions modify watchlist table correctly

- [x] T122 Add WatchlistButton component
  - Component: WatchlistButton.tsx
  - States: loading, not authenticated (tooltip), watching, not watching
  - Test: button toggles watchlist state; shows tooltip when logged out

- [X] T123 Add /watchlist page
  - Shows user's saved indicators with next release date
  - Redirects to home if not authenticated
  - Test: saved indicators appear; empty state when none saved

- [X] T124 Add WatchlistButton to indicator detail page
  - Test: can add/remove indicator from watchlist on detail page

## 3) Calendar Watchlist Filter
- [ ] T130 Add "My Watchlist" toggle to CalendarFilters
  - Only shows when authenticated
  - Test: toggle filters calendar to only watchlist items

## 4) Polish + Documentation
- [ ] T140 Add loading states for auth components
  - Test: no layout shift during auth state resolution

- [ ] T141 Update CHANGELOG.md with L1 features
  - Test: changelog documents user accounts + watchlist

- [ ] T142 Update SPEC.md with L1 user stories
  - Add: "As a user, I can sign in and save indicators to my watchlist"
  - Test: spec reflects implemented features

---

## Acceptance Criteria Summary

### User Accounts
- Magic link authentication (no passwords)
- Profile auto-created on signup
- Session persists across page refreshes
- Sign out clears session

### Watchlist
- Add/remove indicators from watchlist
- View all watchlist items on /watchlist page
- Filter calendar by watchlist
- Watchlist persists across sessions

### Security
- RLS enforces user data isolation
- No user can access another user's watchlist
- Auth state validated server-side
