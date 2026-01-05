# Macro Calendar — Product Spec (L1)

## Goal
Add authenticated watchlists on top of the public macroeconomic calendar.

## Non-goals (for L1)
- Paid data feeds or premium tiers
- Real-time alerts, webhooks, or push notifications
- Billing, quotas, or multi-tenant admin
- Complex roles/permissions beyond basic admin secret

## L1 User Stories
1. As a visitor, I can browse upcoming releases (next 7/30 days) with search and filters.
2. As a signed-in user, I can save or remove indicators from my watchlist from calendar rows and indicator pages.
3. As a signed-in user, I can view my saved indicators on `/watchlist` with the next release date.
4. As a signed-in user, I can filter the calendar to only show my watchlist items.
5. As an admin, I can upload a CSV to add/update releases (secured by admin secret until L2 auth roles exist).

## Data Model (L1)
### Table: indicators (existing)
- id (uuid, pk)
- name (text) e.g., "CPI (YoY)"
- country_code (text)
- category (text)
- source_name (text)
- source_url (text)
- created_at (timestamptz)

### Table: releases (existing)
- id (uuid, pk)
- indicator_id (uuid, fk -> indicators.id)
- release_at (timestamptz)  // scheduled time
- period (text)             // e.g. "Dec 2025"
- actual (text, nullable)
- forecast (text, nullable)
- previous (text, nullable)
- revised (text, nullable)
- unit (text, nullable)
- notes (text, nullable)
- created_at (timestamptz)

Indexes:
- releases(release_at)
- releases(indicator_id, release_at desc)
- indicators(country_code)
- indicators(category)

### Table: profiles (new)
- id (uuid, pk, references auth.users.id)
- email (text, not null)
- display_name (text, nullable)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())
- Trigger: auto-create profile on `auth.users` insert
- RLS: users can select/update only their profile row

### Table: watchlist (new)
- id (uuid, pk, default gen_random_uuid())
- user_id (uuid, fk -> profiles.id)
- indicator_id (uuid, fk -> indicators.id)
- created_at (timestamptz, default now())
- Unique: (user_id, indicator_id)
- RLS: users can CRUD only their own rows

## Core Screens (L1)
1) "/" Calendar
- Default view: next 7 days; optionally 30-day view
- Filters: country, category; search by indicator name
- Watchlist toggle shown only when authenticated
- Rows show Add/Remove watchlist button (disabled/tooltip when logged out)

2) "/watchlist"
- Requires authentication; redirects to home when logged out
- Lists saved indicators with next release date/time
- Empty state when no items saved

3) "/indicator/[id]"
- Indicator header (name, country, category, source)
- Historical releases table (limit 200, most recent first)
- Watchlist button for the indicator

4) Auth UI
- Header with UserMenu (sign in/out)
- AuthModal for magic-link email sign-in
- `/auth/callback` route handles Supabase auth redirect

5) "/admin/upload"
- CSV upload form
- Access: requires ADMIN_UPLOAD_SECRET (until roles land)
- Behavior: upsert indicators + insert/update releases; batched inserts (T092)

## CSV Format
Columns (required):
- indicator_name
- country_code
- category
- source_name
- source_url
- release_at (ISO8601)
- period

Optional:
- actual, forecast, previous, revised, unit, notes

## Quality Bar
- Every feature must have acceptance criteria and manual test steps
- No silent refactors
- No new feature outside L1 without updating this spec
- Security: RLS enforced for profiles/watchlist; admin secret validated server-side

## Deployment
- Vercel for app hosting
- Supabase for DB + auth
- Environment variables set in Vercel project settings (includes auth, admin secret, and service role key)
