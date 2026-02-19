-- Test: Verify data_sources and sync_logs tables (T400)
-- Run this AFTER executing 023_create_data_sources.sql
-- Test steps documented for manual verification

-- =============================================================================
-- VERIFY: data_sources table exists with correct columns
-- =============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'data_sources'
ORDER BY ordinal_position;

-- Expected columns:
-- id: uuid, NO, gen_random_uuid()
-- name: text, NO, null
-- type: text, NO, null
-- base_url: text, NO, null
-- auth_config: jsonb, NO, '{}'::jsonb
-- enabled: boolean, NO, true
-- last_sync_at: timestamp with time zone, YES, null
-- created_at: timestamp with time zone, NO, now()

-- =============================================================================
-- VERIFY: data_sources has correct constraints
-- =============================================================================

SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'data_sources'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Expected constraints:
-- data_sources_pkey: PRIMARY KEY on id
-- data_sources_name_key: UNIQUE on name
-- data_sources_type_check: CHECK on type

-- =============================================================================
-- VERIFY: data_sources check constraint for type
-- =============================================================================

SELECT 
    conname, 
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'data_sources'::regclass
AND contype = 'c';

-- Expected: type IN ('scraper', 'api')

-- =============================================================================
-- VERIFY: sync_logs table exists with correct columns
-- =============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'sync_logs'
ORDER BY ordinal_position;

-- Expected columns:
-- id: uuid, NO, gen_random_uuid()
-- data_source_id: uuid, NO, null
-- status: text, NO, null
-- records_processed: integer, NO, 0
-- error_message: text, YES, null
-- started_at: timestamp with time zone, NO, now()
-- completed_at: timestamp with time zone, YES, null

-- =============================================================================
-- VERIFY: sync_logs has correct constraints
-- =============================================================================

SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'sync_logs'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Expected constraints:
-- sync_logs_pkey: PRIMARY KEY on id
-- sync_logs_data_source_id_fkey: FOREIGN KEY on data_source_id

-- =============================================================================
-- VERIFY: sync_logs check constraint for status
-- =============================================================================

SELECT 
    conname, 
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'sync_logs'::regclass
AND contype = 'c';

-- Expected: status IN ('success', 'partial', 'failed', 'in_progress')

-- =============================================================================
-- VERIFY: data_sources indexes exist
-- =============================================================================

SELECT 
    indexname, 
    indexdef
FROM pg_indexes
WHERE tablename = 'data_sources';

-- Expected indexes:
-- data_sources_pkey: CREATE UNIQUE INDEX data_sources_pkey ON data_sources USING btree (id)
-- data_sources_name_key: CREATE UNIQUE INDEX data_sources_name_key ON data_sources USING btree (name)
-- idx_data_sources_type: CREATE INDEX idx_data_sources_type ON data_sources USING btree (type)
-- idx_data_sources_enabled: CREATE INDEX idx_data_sources_enabled ON data_sources USING btree (enabled) WHERE enabled = true

-- =============================================================================
-- VERIFY: sync_logs indexes exist
-- =============================================================================

SELECT 
    indexname, 
    indexdef
FROM pg_indexes
WHERE tablename = 'sync_logs';

-- Expected indexes:
-- sync_logs_pkey: CREATE UNIQUE INDEX sync_logs_pkey ON sync_logs USING btree (id)
-- idx_sync_logs_data_source_id: CREATE INDEX idx_sync_logs_data_source_id ON sync_logs USING btree (data_source_id)
-- idx_sync_logs_started_at: CREATE INDEX idx_sync_logs_started_at ON sync_logs USING btree (started_at DESC)
-- idx_sync_logs_status: CREATE INDEX idx_sync_logs_status ON sync_logs USING btree (status)
-- idx_sync_logs_data_source_started: CREATE INDEX idx_sync_logs_data_source_started ON sync_logs USING btree (data_source_id, started_at DESC)

-- =============================================================================
-- VERIFY: Default data sources are seeded
-- =============================================================================

SELECT 
    name,
    type,
    enabled,
    base_url
FROM data_sources
ORDER BY name;

-- Expected (5 rows, all disabled by default):
-- BLS, api, false, https://api.bls.gov/publicAPI/v2
-- ECB, api, false, https://sdw-wsrest.ecb.europa.eu/service
-- ForexFactory, scraper, false, https://www.forexfactory.com/calendar
-- FRED, api, false, https://api.stlouisfed.org/fred
-- Investing.com, scraper, false, https://www.investing.com/economic-calendar

-- =============================================================================
-- VERIFY: Foreign key cascade works (sync_logs deleted when data_source deleted)
-- =============================================================================

-- Step 1: Create a test data source
INSERT INTO data_sources (id, name, type, base_url, enabled)
VALUES ('99999999-9999-4999-a999-999999999999', 'TestSource', 'api', 'https://test.example.com', false);

-- Step 2: Create a test sync log for that source
INSERT INTO sync_logs (data_source_id, status, records_processed)
VALUES ('99999999-9999-4999-a999-999999999999', 'success', 10);

-- Step 3: Verify sync log exists
SELECT COUNT(*) FROM sync_logs WHERE data_source_id = '99999999-9999-4999-a999-999999999999';
-- Expected: 1

-- Step 4: Delete the data source
DELETE FROM data_sources WHERE id = '99999999-9999-4999-a999-999999999999';

-- Step 5: Verify sync log was cascaded
SELECT COUNT(*) FROM sync_logs WHERE data_source_id = '99999999-9999-4999-a999-999999999999';
-- Expected: 0

-- =============================================================================
-- VERIFY: Type constraint rejects invalid values
-- =============================================================================

-- This should fail with a check constraint violation:
-- INSERT INTO data_sources (name, type, base_url)
-- VALUES ('InvalidType', 'invalid', 'https://example.com');
-- Expected error: new row for relation "data_sources" violates check constraint "data_sources_type_check"

-- =============================================================================
-- VERIFY: Status constraint rejects invalid values
-- =============================================================================

-- This should fail with a check constraint violation:
-- INSERT INTO sync_logs (data_source_id, status)
-- VALUES ((SELECT id FROM data_sources LIMIT 1), 'invalid_status');
-- Expected error: new row for relation "sync_logs" violates check constraint "sync_logs_status_check"

-- =============================================================================
-- VERIFY: Name uniqueness enforced
-- =============================================================================

-- This should fail with a unique constraint violation:
-- INSERT INTO data_sources (name, type, base_url)
-- VALUES ('FRED', 'api', 'https://other.example.com');
-- Expected error: duplicate key value violates unique constraint "data_sources_name_key"
