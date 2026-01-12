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

### 2. Test the Schema (Optional)

To verify the schema:

1. `001_test_seed.sql` - Test data for indicators and releases (uses dynamic dates, always within next 7 days)
2. `004_test_alert_preferences.sql` - Verification queries for alert_preferences

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
