# Supabase Migrations

## Setup Instructions

### 1. Execute Initial Migration

In your Supabase SQL Editor:

1. Open the SQL Editor in your Supabase project dashboard
2. Copy and paste the contents of `001_create_tables.sql`
3. Execute the SQL
4. Verify tables appear in the Table Editor

### 2. Test the Schema (Optional)

To verify inserts work:

1. In the SQL Editor, copy and paste `001_test_seed.sql`
2. Execute the SQL
3. Verify the query returns sample data

### 3. Verify Indexes

Run this query to confirm all indexes exist:

```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('indicators', 'releases')
ORDER BY tablename, indexname;
```

Expected indexes:
- `idx_releases_release_at`
- `idx_releases_indicator_release`
- `idx_indicators_country_code`
- `idx_indicators_category`

## Schema Overview

### indicators table
- Stores economic indicators (e.g., "CPI (YoY)", "Unemployment Rate")
- Columns: id, name, country_code, category, source_name, source_url, created_at

### releases table
- Stores scheduled and historical releases for each indicator
- Columns: id, indicator_id (FK), release_at, period, actual, forecast, previous, revised, unit, notes, created_at
- Foreign key cascade deletes: deleting an indicator deletes its releases

## Clean Up (Development Only)

To drop tables and start fresh:

```sql
DROP TABLE IF EXISTS releases CASCADE;
DROP TABLE IF EXISTS indicators CASCADE;
```

Then re-run `001_create_tables.sql`.
