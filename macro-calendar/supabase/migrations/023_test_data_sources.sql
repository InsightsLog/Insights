-- Test: Verify data_sources and sync_logs tables (T400)
-- Run this AFTER executing 023_create_data_sources.sql
-- Test steps documented for manual verification

-- =============================================================================
-- VERIFY: data_sources table structure
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
-- id (uuid, NO, gen_random_uuid())
-- name (text, NO, null)
-- type (text, NO, null)
-- base_url (text, NO, null)
-- auth_config (jsonb, NO, '{}'::jsonb)
-- enabled (boolean, NO, true)
-- last_sync_at (timestamp with time zone, YES, null)
-- created_at (timestamp with time zone, NO, now())

-- =============================================================================
-- VERIFY: sync_logs table structure
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
-- id (uuid, NO, gen_random_uuid())
-- data_source_id (uuid, NO, null)
-- status (text, NO, null)
-- records_processed (integer, NO, 0)
-- error_message (text, YES, null)
-- started_at (timestamp with time zone, NO, now())
-- completed_at (timestamp with time zone, YES, null)

-- =============================================================================
-- VERIFY: CHECK constraints on data_sources.type
-- =============================================================================

SELECT
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'data_sources'
    AND tc.constraint_type = 'CHECK';

-- Expected: type IN ('scraper', 'api')

-- =============================================================================
-- VERIFY: CHECK constraints on sync_logs.status
-- =============================================================================

SELECT
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'sync_logs'
    AND tc.constraint_type = 'CHECK';

-- Expected: status IN ('success', 'partial', 'failed')

-- =============================================================================
-- VERIFY: Indexes exist
-- =============================================================================

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('data_sources', 'sync_logs')
ORDER BY tablename, indexname;

-- Expected indexes:
-- data_sources: data_sources_pkey, idx_data_sources_enabled, idx_data_sources_type
-- sync_logs: sync_logs_pkey, idx_sync_logs_data_source_id, idx_sync_logs_started_at

-- =============================================================================
-- VERIFY: RLS is enabled on both tables
-- =============================================================================

SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename IN ('data_sources', 'sync_logs');

-- Expected: both have rowsecurity = true

-- =============================================================================
-- VERIFY: No public RLS policies (admin-only via service role)
-- =============================================================================

SELECT
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('data_sources', 'sync_logs')
ORDER BY tablename, policyname;

-- Expected: No rows returned (no policies = only service role can access)

-- =============================================================================
-- VERIFY: Foreign key on sync_logs.data_source_id
-- =============================================================================

SELECT
    tc.constraint_name,
    tc.table_name AS from_table,
    kcu.column_name AS from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'sync_logs'
    AND tc.constraint_type = 'FOREIGN KEY';

-- Expected:
-- sync_logs_data_source_id_fkey: data_source_id -> data_sources(id), delete_rule = CASCADE

-- =============================================================================
-- TEST: Can create data source (via service role)
-- =============================================================================
--
-- INSERT INTO data_sources (name, type, base_url, auth_config)
-- VALUES (
--     'FRED',
--     'api',
--     'https://api.stlouisfed.org/fred',
--     '{"api_key": "test_key_123"}'::jsonb
-- );
--
-- SELECT * FROM data_sources WHERE name = 'FRED';
-- Expected: Data source created with enabled=true, last_sync_at=null

-- =============================================================================
-- TEST: Type CHECK constraint works
-- =============================================================================
--
-- INSERT INTO data_sources (name, type, base_url)
-- VALUES ('Invalid', 'invalid_type', 'https://example.com');
--
-- Expected: Error - violates check constraint (type must be 'scraper' or 'api')

-- =============================================================================
-- TEST: Status CHECK constraint works
-- =============================================================================
--
-- First create a data source, then:
-- INSERT INTO sync_logs (data_source_id, status)
-- VALUES ('<data_source_id>', 'invalid_status');
--
-- Expected: Error - violates check constraint (status must be 'success', 'partial', or 'failed')

-- =============================================================================
-- TEST: Cascade delete - deleting data source removes sync logs
-- =============================================================================
--
-- 1. Create a data source
-- 2. Create sync log entries for that data source
-- 3. Delete the data source
-- 4. Verify sync logs are also deleted
--
-- Expected: Sync logs automatically deleted when data source is deleted

-- =============================================================================
-- TEST: RLS blocks anonymous/authenticated user access
-- =============================================================================
--
-- As an authenticated (non-service-role) user:
-- SELECT * FROM data_sources;
-- Expected: No rows returned (RLS blocks, no policies allow access)
--
-- INSERT INTO data_sources (name, type, base_url) VALUES ('Test', 'api', 'https://example.com');
-- Expected: Error - violates RLS policy (no INSERT policy)

-- =============================================================================
-- VERIFY: Table comments exist
-- =============================================================================

SELECT
    c.column_name,
    pgd.description
FROM pg_catalog.pg_statio_all_tables st
INNER JOIN pg_catalog.pg_description pgd ON pgd.objoid = st.relid
INNER JOIN information_schema.columns c ON
    c.table_schema = st.schemaname
    AND c.table_name = st.relname
    AND pgd.objsubid = c.ordinal_position
WHERE st.relname = 'data_sources'
ORDER BY c.ordinal_position;

-- Expected: Comments exist for all columns

SELECT
    c.column_name,
    pgd.description
FROM pg_catalog.pg_statio_all_tables st
INNER JOIN pg_catalog.pg_description pgd ON pgd.objoid = st.relid
INNER JOIN information_schema.columns c ON
    c.table_schema = st.schemaname
    AND c.table_name = st.relname
    AND pgd.objsubid = c.ordinal_position
WHERE st.relname = 'sync_logs'
ORDER BY c.ordinal_position;

-- Expected: Comments exist for all columns
