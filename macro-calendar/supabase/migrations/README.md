# Supabase Migrations

## Setup Instructions

### 1. Execute Migrations in Order

In your Supabase SQL Editor, execute the migrations in the following order:

1. `001_create_tables.sql` - Creates indicators and releases tables
2. `002_create_profiles.sql` - Creates profiles table and auth triggers
3. `003_create_watchlist.sql` - Creates watchlist table with RLS
4. `004_create_alert_preferences.sql` - Creates alert_preferences table with RLS

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
