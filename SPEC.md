# Macro Calendar — Product Spec (L4)

## Goal
Add automated data acquisition, mobile app, calendar integrations, and advanced analytics on top of the existing calendar, watchlist, alerts, webhooks, API, and billing features.

## Non-goals (for L4)
- Machine learning predictions (L5)
- Social features (comments, community watchlists) (L5)
- Broker integrations for trade execution (L5)
- Custom alert conditions beyond analytics thresholds (L5)

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

## L3 User Stories (Shipped)
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

## L4 User Stories
### Data Acquisition
1. As an admin, I can configure data sources for automatic release schedule imports.
2. As a user, release schedules are automatically populated from ForexFactory/Investing.com.
3. As a user, actual release values are automatically imported from FRED, BLS, and ECB APIs.
4. As an admin, I can view data sync logs and manually trigger syncs.

### Mobile App
5. As a mobile user, I can sign in with magic link and view the calendar.
6. As a mobile user, I can manage my watchlist and receive push notifications.
7. As a mobile user, I have a native app experience on iOS and Android.

### Calendar Integrations
8. As a signed-in user, I can connect my Google Calendar account.
9. As a signed-in user, I can connect my Outlook Calendar account.
10. As a user with connected calendar, my watchlist releases sync to my calendar.
11. As a user, I can configure reminder times for calendar events.

### Historical Data API
12. As a developer, I can access historical time series data via the API.
13. As a developer, I can bulk export historical data for backtesting.

### Advanced Analytics
14. As a user, I can view actual vs forecast comparisons for indicators.
15. As a user, I can see correlations between different indicators.
16. As a user, I can set alerts based on analytics thresholds (surprise exceeds X).

## Data Model (L4)

### Existing Tables (L1-L3)
- indicators, releases, profiles, watchlist, alert_preferences, user_roles, audit_log
- api_keys, request_logs, webhook_endpoints, webhook_deliveries
- plans, subscriptions, organizations, organization_members, usage_alerts_sent

### Table: data_sources (new)
- id (uuid, pk, default gen_random_uuid())
- name (text, not null) — 'ForexFactory', 'FRED', 'BLS', 'ECB'
- type (text, not null) — 'scraper', 'api'
- base_url (text, not null)
- auth_config (jsonb, default '{}') — encrypted API credentials
- enabled (boolean, default true)
- last_sync_at (timestamptz, nullable)
- created_at (timestamptz, default now())
- No RLS (admin-only access via service role)

### Table: sync_logs (new)
- id (uuid, pk, default gen_random_uuid())
- data_source_id (uuid, fk -> data_sources.id)
- status (text, not null) — 'success', 'partial', 'failed'
- records_processed (int, default 0)
- error_message (text, nullable)
- started_at (timestamptz, default now())
- completed_at (timestamptz, nullable)
- No RLS (admin-only access via service role)

### Table: calendar_integrations (new)
- id (uuid, pk, default gen_random_uuid())
- user_id (uuid, fk -> profiles.id)
- provider (text, not null) — 'google', 'outlook'
- access_token (text, encrypted)
- refresh_token (text, encrypted)
- token_expires_at (timestamptz)
- calendar_id (text, nullable) — specific calendar to sync to
- reminder_minutes (int, default 15)
- enabled (boolean, default true)
- created_at (timestamptz, default now())
- RLS: users can CRUD only their own integrations

### Table: push_subscriptions (new)
- id (uuid, pk, default gen_random_uuid())
- user_id (uuid, fk -> profiles.id)
- expo_push_token (text, not null)
- device_type (text) — 'ios', 'android'
- created_at (timestamptz, default now())
- RLS: users can CRUD only their own subscriptions

### Column Addition: releases.surprise (computed)
- surprise (numeric) — actual - forecast, computed on insert/update

## Core Screens (L4)

### New Screens

1) "/admin/data-sources" (new)
- Data source management
- Configure scrapers and API sources
- View sync logs and status
- Manual sync triggers

2) "/settings/integrations" (new)
- Calendar integration management
- Connect Google/Outlook accounts
- Configure sync settings
- Manage reminder preferences

3) "/indicator/:id/analytics" (new)
- Actual vs forecast chart
- Surprise history
- Forecast accuracy metrics
- Correlation with other indicators

4) "/docs/api" (modified from L3)
- Add historical data endpoints
- Add bulk export documentation
- Add backtesting examples

### Mobile App Screens

1) Calendar Screen
- Upcoming releases list
- Country/category filters
- Pull-to-refresh

2) Watchlist Screen
- Saved indicators
- Alert toggles
- Add/remove buttons

3) Indicator Detail Screen
- Indicator info
- Historical releases
- Charts and analytics

4) Settings Screen
- Profile management
- Notification preferences
- Push notification toggle

### API Routes (new)

1) GET /api/v1/historical/:indicator_id
- Historical time series data
- Auth: API key required

2) GET /api/v1/historical/bulk
- Multi-indicator export
- Auth: API key required

3) POST /api/integrations/google/callback
- Google OAuth callback
- Auth: Session required

4) POST /api/integrations/outlook/callback
- Outlook OAuth callback
- Auth: Session required

### Modified Screens

1) "/admin" (modified from L2)
- Add data sources section
- Add sync status overview

2) "/settings" (modified)
- Add integrations link
- Add mobile app section

## Quality Bar
- Every feature must have acceptance criteria and manual test steps
- No silent refactors
- No new feature outside L4 without updating this spec
- Security: RLS enforced for all user-specific tables; role checks for admin features
- Audit logging for all admin actions
- API rate limiting and quota enforcement
- Data acquisition must handle source failures gracefully

## Deployment
- Vercel for app hosting
- Supabase for DB + auth + Edge Functions
- Resend or SendGrid for email delivery
- Stripe for payment processing
- Upstash Redis for rate limiting
- Expo for mobile app builds
- Environment variables: existing + Google/Outlook OAuth credentials
