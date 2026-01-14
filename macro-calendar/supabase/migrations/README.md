# Supabase Migrations

## Setup Instructions

### 1. Execute Migrations in Order

In your Supabase SQL Editor, execute the migrations in the following order:

1. `001_create_tables.sql` - Creates indicators and releases tables
2. `002_create_profiles.sql` - Creates profiles table and auth triggers
3. `003_create_watchlist.sql` - Creates watchlist table with RLS
4. `004_create_alert_preferences.sql` - Creates alert_preferences table with RLS
5. `006_create_user_roles.sql` - Creates user_roles table for role-based access
6. `007_create_audit_log.sql` - Creates audit_log table for admin action tracking
7. `008_create_api_keys.sql` - Creates api_keys table for API key management
8. `009_create_request_logs.sql` - Creates request_logs table for request logging
9. `010_add_revision_history.sql` - Adds revision_history column to releases table
10. `011_create_webhook_endpoints.sql` - Creates webhook_endpoints table with RLS
11. `012_create_webhook_delivery_trigger.sql` - Documents webhook trigger configuration
12. `013_create_webhook_deliveries.sql` - Creates webhook_deliveries table (no RLS)
13. `014_add_api_usage_tracking.sql` - Adds API usage tracking columns to request_logs
14. `015_create_plans.sql` - Creates plans table with subscription tiers
15. `016_create_subscriptions.sql` - Creates subscriptions table for billing
16. `017_create_usage_alerts_sent.sql` - Creates usage_alerts_sent table for tracking alerts
17. `018_create_organizations.sql` - Creates organizations table for multi-tenant admin
18. `019_create_organization_members.sql` - Creates organization_members table with RLS

### 2. Test the Schema (Optional)

To verify the schema:

1. `001_test_seed.sql` - Test data for indicators and releases (uses dynamic dates, always within next 7 days)
2. `004_test_alert_preferences.sql` - Verification queries for alert_preferences
3. `015_test_plans.sql` - Verification queries for plans table
4. `016_test_subscriptions.sql` - Verification queries for subscriptions table
5. `017_test_usage_alerts_sent.sql` - Verification queries for usage_alerts_sent table
6. `018_test_organizations.sql` - Verification queries for organizations table
7. `019_test_organization_members.sql` - Verification queries for organization_members table

### 3. Verify Indexes

Run this query to confirm all indexes exist:

```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('indicators', 'releases', 'profiles', 'watchlist', 'alert_preferences')
ORDER BY tablename, indexname;
```

Expected indexes:
- `idx_releases_release_at`
- `idx_releases_indicator_release`
- `idx_indicators_country_code`
- `idx_indicators_category`
- `idx_profiles_email`
- `idx_watchlist_user_id`
- `idx_watchlist_indicator_id`
- `idx_alert_preferences_user_id`
- `idx_alert_preferences_indicator_id`
- `idx_alert_preferences_email_enabled`

## Schema Overview

### indicators table
- Stores economic indicators (e.g., "CPI (YoY)", "Unemployment Rate")
- Columns: id, name, country_code, category, source_name, source_url, created_at

### releases table
- Stores scheduled and historical releases for each indicator
- Columns: id, indicator_id (FK), release_at, period, actual, forecast, previous, revised, unit, notes, created_at
- Foreign key cascade deletes: deleting an indicator deletes its releases

### profiles table
- Stores user profiles linked to Supabase Auth users
- Columns: id (FK to auth.users), email, display_name, created_at, updated_at
- RLS: users can only read/update their own profile

### watchlist table
- Stores user-indicator relationships for saved/watched indicators
- Columns: id, user_id (FK), indicator_id (FK), created_at
- RLS: users can only CRUD their own watchlist items
- Unique constraint: (user_id, indicator_id)

### alert_preferences table
- Stores user email alert preferences for specific indicators
- Columns: id, user_id (FK), indicator_id (FK), email_enabled, created_at, updated_at
- RLS: users can only CRUD their own alert preferences
- Unique constraint: (user_id, indicator_id)

### webhook_endpoints table
- Stores user webhook endpoint configurations for release notifications
- Columns: id, user_id (FK), url, secret, events, enabled, created_at, updated_at, last_triggered_at
- RLS: users can only CRUD their own webhook endpoints
- Events: array of event types ('release.published', 'release.revised')

### webhook_deliveries table
- Stores webhook delivery attempt logs for debugging and monitoring
- Columns: id, webhook_id (FK), event_type, payload, response_code, response_body, attempted_at
- No RLS: admin-only access via service role (delivery logs not exposed to users)
- Cascade delete: when webhook_endpoint is deleted, its deliveries are also deleted

### plans table
- Stores subscription plan definitions with pricing and feature limits
- Columns: id, name, price_monthly, price_yearly, api_calls_limit, webhook_limit, features
- RLS: public read access (plans are public information), admin-only write
- Seeded with: Free, Plus, Pro, Enterprise tiers

### subscriptions table
- Stores user subscriptions linking users to billing plans
- Columns: id, user_id (FK to profiles), plan_id (FK to plans), stripe_subscription_id, status, current_period_end, created_at
- Status values: 'active', 'canceled', 'past_due', 'trialing'
- RLS: users can only read their own subscription (all writes via service role)
- Foreign key behavior: CASCADE on user deletion, RESTRICT on plan deletion

### organizations table
- Stores organizations for multi-tenant team features
- Columns: id, name, slug (unique, URL-friendly), owner_id (FK to profiles), created_at
- RLS: owners can CRUD their own organizations; org members can read
- Foreign key behavior: CASCADE on owner deletion
- Unique constraint: slug (for URL-friendly organization identifiers)

### organization_members table
- Stores organization membership with role assignments
- Columns: id, org_id (FK to organizations), user_id (FK to profiles), role, invited_at, joined_at
- Roles: 'owner', 'admin', 'member' (enforced by CHECK constraint)
- RLS: org members can read; org admins/owners can write (INSERT, UPDATE, DELETE)
- Foreign key behavior: CASCADE on org deletion, CASCADE on user deletion
- Unique constraint: (org_id, user_id) - one membership per user per org
- Helper function: `is_org_admin(org_id)` for RLS policy checks

## Clean Up (Development Only)

To drop tables and start fresh:

```sql
DROP TABLE IF EXISTS alert_preferences CASCADE;
DROP TABLE IF EXISTS watchlist CASCADE;
DROP TABLE IF EXISTS releases CASCADE;
DROP TABLE IF EXISTS indicators CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
```

Then re-run migrations in order.
