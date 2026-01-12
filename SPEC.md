# Macro Calendar — Product Spec (L3)

## Goal
Add webhooks, public REST API, billing integration, and multi-tenant admin features on top of the existing calendar, watchlist, and email alert features.

## Non-goals (for L3)
- Mobile app (L4)
- Calendar integrations (Google Calendar, Outlook) (L4)
- Historical data API for backtesting (L4)
- Advanced analytics and charting (L4)

## L1 User Stories (Shipped)
1. As a visitor, I can browse upcoming releases (next 7/30 days) with search and filters.
2. As a user, I can sign in and save indicators to my watchlist.
3. As a signed-in user, I can save or remove indicators from my watchlist from calendar rows and indicator pages.
4. As a signed-in user, I can view my saved indicators on `/watchlist` with the next release date.
5. As a signed-in user, I can filter the calendar to only show my watchlist items.
6. As an admin, I can upload a CSV to add/update releases (secured by admin secret until L2 auth roles exist).

## L2 User Stories (Shipped)
1. As a signed-in user, I can enable email alerts for specific indicators on my watchlist.
2. As a user with alerts enabled, I receive an email when a new release is published for that indicator.
3. As a user, I can one-click unsubscribe from email alerts without logging in.
4. As an admin, I can grant or revoke admin access to other users.
5. As an admin, I can view audit logs of all admin actions.
6. As a signed-in user, I can see when an actual value was revised with the change history.
7. As a visitor, I can see a "Revised" badge on calendar rows with revisions.
8. As a signed-in user, I can generate API keys for programmatic access.
9. As a signed-in user, I can revoke my API keys.
10. As a signed-in user, I can view my API key usage.

## L3 User Stories
### Webhooks
1. As a signed-in user, I can register webhook endpoints to receive release notifications.
2. As a user with webhooks configured, I receive HTTP POST requests when releases are published.
3. As a user, I can view webhook delivery history and retry failed deliveries.

### Public REST API
4. As a developer, I can access indicator and release data via a versioned REST API.
5. As a developer, I can authenticate API requests using my API key.
6. As a developer, I can view interactive API documentation.

### Billing & Quotas
7. As a user, I can subscribe to paid plans for higher API limits.
8. As a subscriber, I receive alerts when approaching usage limits.
9. As a subscriber, I can upgrade/downgrade my plan via Stripe.

### Multi-Tenant Admin
10. As a user, I can create an organization and invite team members.
11. As an org admin, I can manage member roles and permissions.
12. As an org member, I can access shared organization watchlists.

### Data Export
13. As a signed-in user, I can export my watchlist releases to CSV/JSON.
14. As a signed-in user, I can generate an iCal feed for my watchlist.

## Data Model (L3)

### Existing Tables (L1-L2)
- indicators, releases, profiles, watchlist, alert_preferences, user_roles, audit_log, api_keys, request_logs

### Table: webhook_endpoints (new)
- id (uuid, pk, default gen_random_uuid())
- user_id (uuid, fk -> profiles.id)
- url (text, not null) — HTTPS URL to receive webhooks
- secret (text, not null) — HMAC signing secret
- events (text[], default '{release.published}') — subscribed event types
- enabled (boolean, default true)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())
- last_triggered_at (timestamptz, nullable)
- RLS: users can CRUD only their own webhooks

### Table: webhook_deliveries (new)
- id (uuid, pk, default gen_random_uuid())
- webhook_id (uuid, fk -> webhook_endpoints.id)
- event_type (text, not null)
- payload (jsonb, not null)
- response_code (int, nullable)
- response_body (text, nullable)
- attempted_at (timestamptz, default now())
- No RLS (admin-only access via service role)

### Table: plans (new)
- id (uuid, pk, default gen_random_uuid())
- name (text, not null) — 'Free', 'Pro', 'Enterprise'
- price_monthly (int, not null) — cents
- price_yearly (int, nullable) — cents
- api_calls_limit (int, not null) — monthly API call limit
- webhook_limit (int, not null) — max webhook endpoints
- features (jsonb, default '{}')

### Table: subscriptions (new)
- id (uuid, pk, default gen_random_uuid())
- user_id (uuid, fk -> profiles.id)
- plan_id (uuid, fk -> plans.id)
- stripe_subscription_id (text, nullable)
- status (text, check in ('active', 'canceled', 'past_due', 'trialing'))
- current_period_end (timestamptz, nullable)
- created_at (timestamptz, default now())
- RLS: users can read only their own subscription

### Table: organizations (new)
- id (uuid, pk, default gen_random_uuid())
- name (text, not null)
- slug (text, unique, not null) — URL-friendly identifier
- owner_id (uuid, fk -> profiles.id)
- created_at (timestamptz, default now())

### Table: organization_members (new)
- id (uuid, pk, default gen_random_uuid())
- org_id (uuid, fk -> organizations.id)
- user_id (uuid, fk -> profiles.id)
- role (text, check in ('owner', 'admin', 'member'))
- invited_at (timestamptz, default now())
- joined_at (timestamptz, nullable)
- RLS: org members can read; org admins can write

### Column Addition: watchlist.org_id (optional)
- org_id (uuid, fk -> organizations.id, nullable)
- NULL for personal watchlists, set for shared org watchlists

## Core Screens (L3)

### New Screens

1) "/settings/webhooks" (new)
- Webhook endpoint management
- Create/edit/delete webhook URLs
- Test webhook with sample payload
- View delivery history

2) "/docs/api" (new)
- Interactive API documentation
- Code examples in multiple languages
- API key instructions

3) "/settings/billing" (new)
- Current plan and usage display
- Upgrade/downgrade options
- Payment history
- Cancel subscription

4) "/org/:slug" (new)
- Organization dashboard
- Member list with roles
- Shared watchlists
- Organization settings

5) "/org/:slug/settings" (new)
- Manage organization name, slug
- Invite/remove members
- Assign roles
- Transfer ownership

### Modified Screens

1) "/settings/api-keys" (modified from L2)
- Add usage statistics
- Show plan limits
- Link to upgrade

2) "/watchlist" (modified)
- Toggle between personal and org watchlists
- Create shared watchlist (for org members)

### API Routes (new)

1) GET /api/v1/indicators
- List all indicators with pagination
- Auth: API key required

2) GET /api/v1/indicators/:id
- Get single indicator with releases
- Auth: API key required

3) GET /api/v1/releases
- List releases with filters
- Auth: API key required

4) GET /api/v1/calendar
- Get upcoming releases
- Auth: API key required

5) POST /api/stripe/webhook
- Handle Stripe payment events
- Auth: Stripe signature validation

## Quality Bar
- Every feature must have acceptance criteria and manual test steps
- No silent refactors
- No new feature outside L3 without updating this spec
- Security: RLS enforced for all user-specific tables; role checks for admin features
- Audit logging for all admin actions
- API rate limiting and quota enforcement

## Deployment
- Vercel for app hosting
- Supabase for DB + auth + Edge Functions
- Resend or SendGrid for email delivery
- Stripe for payment processing
- Upstash Redis for rate limiting
- Environment variables: existing + Stripe keys
