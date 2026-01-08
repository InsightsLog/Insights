# Macro Calendar — Product Spec (L2)

## Goal
Add email alerts, role-based admin access, and enhanced security on top of the existing calendar and watchlist features.

## Non-goals (for L2)
- Paid data feeds or premium tiers
- Webhook/push notifications (L3)
- Full public API (L3)
- Billing, quotas, or usage limits (L3)

## L1 User Stories (Shipped)
1. As a visitor, I can browse upcoming releases (next 7/30 days) with search and filters.
2. As a user, I can sign in and save indicators to my watchlist.
3. As a signed-in user, I can save or remove indicators from my watchlist from calendar rows and indicator pages.
4. As a signed-in user, I can view my saved indicators on `/watchlist` with the next release date.
5. As a signed-in user, I can filter the calendar to only show my watchlist items.
6. As an admin, I can upload a CSV to add/update releases (secured by admin secret until L2 auth roles exist).

## L2 User Stories
1. As a signed-in user, I can enable email alerts for specific indicators on my watchlist.
2. As a user with alerts enabled, I receive an email when a new release is published for that indicator.
3. As a user, I can one-click unsubscribe from email alerts without logging in.
4. As an admin, I can grant or revoke admin access to other users.
5. As an admin, I can view audit logs of all admin actions.
6. As a signed-in user, I can see when an actual value was revised with the change history.
7. As a visitor, I can see a "Revised" badge on calendar rows with revisions.

## Data Model (L2)

### Existing Tables (L1)
- indicators, releases, profiles, watchlist (see L1 spec)

### Table: alert_preferences (new)
- id (uuid, pk, default gen_random_uuid())
- user_id (uuid, fk -> profiles.id)
- indicator_id (uuid, fk -> indicators.id)
- email_enabled (boolean, default false)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())
- Unique: (user_id, indicator_id)
- RLS: users can CRUD only their own rows

### Table: user_roles (new)
- id (uuid, pk, default gen_random_uuid())
- user_id (uuid, fk -> profiles.id)
- role (text, check in ('admin', 'user'))
- granted_at (timestamptz, default now())
- granted_by (uuid, fk -> profiles.id, nullable)
- RLS: only admins can read/write

### Table: audit_log (new)
- id (uuid, pk, default gen_random_uuid())
- user_id (uuid, fk -> profiles.id)
- action (text) — 'upload', 'role_grant', 'role_revoke', etc.
- resource_type (text) — 'release', 'indicator', 'user_role'
- resource_id (uuid, nullable)
- metadata (jsonb, nullable)
- created_at (timestamptz, default now())
- No RLS (admin-only access via service role)

### Column Addition: releases.revision_history
- revision_history (jsonb, default '[]')
- Format: [{previous_actual, new_actual, revised_at}]

## Core Screens (L2)

### New/Modified Screens

1) "/watchlist" (modified)
- Alert toggle next to each indicator
- Shows email alert status (enabled/disabled)

2) "/admin" (new)
- Dashboard showing recent uploads, user count
- Audit log viewer
- User role management

3) "/unsubscribe" (new)
- Token-based unsubscribe without login
- Confirmation message

4) "/indicator/[id]" (modified)
- Revision history section (if any)
- Shows timeline of actual value changes

### Modified Components

1) Calendar row (modified)
- "Revised" badge when revision_history is non-empty
- Tooltip showing latest revision

## Quality Bar
- Every feature must have acceptance criteria and manual test steps
- No silent refactors
- No new feature outside L2 without updating this spec
- Security: RLS enforced for all user-specific tables; role checks for admin features
- Audit logging for all admin actions

## Deployment
- Vercel for app hosting
- Supabase for DB + auth + Edge Functions
- Resend or SendGrid for email delivery
- Environment variables: existing + email service keys
