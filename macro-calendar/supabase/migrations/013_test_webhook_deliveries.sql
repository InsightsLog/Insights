-- Test: Verify webhook_deliveries table structure (T304)
-- Run this AFTER executing 013_create_webhook_deliveries.sql
-- Test steps documented for manual verification

-- =============================================================================
-- VERIFY: Table structure exists
-- =============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'webhook_deliveries'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NO, gen_random_uuid())
-- webhook_id (uuid, NO, null)
-- event_type (text, NO, null)
-- payload (jsonb, NO, null)
-- response_code (integer, YES, null)
-- response_body (text, YES, null)
-- attempted_at (timestamp with time zone, NO, now())

-- =============================================================================
-- VERIFY: Table constraints
-- =============================================================================

SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'webhook_deliveries'
ORDER BY tc.constraint_type, kcu.ordinal_position;

-- Expected: 
-- webhook_deliveries_pkey (PRIMARY KEY) on id
-- webhook_deliveries_webhook_id_fkey (FOREIGN KEY) on webhook_id

-- =============================================================================
-- VERIFY: Indexes exist
-- =============================================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'webhook_deliveries'
ORDER BY indexname;

-- Expected indexes:
-- webhook_deliveries_pkey
-- idx_webhook_deliveries_webhook_id
-- idx_webhook_deliveries_attempted_at
-- idx_webhook_deliveries_webhook_time

-- =============================================================================
-- VERIFY: RLS is NOT enabled (admin-only access)
-- =============================================================================

SELECT 
    tablename, 
    rowsecurity
FROM pg_tables
WHERE tablename = 'webhook_deliveries';

-- Expected: rowsecurity = false (RLS is disabled)

-- =============================================================================
-- VERIFY: No RLS policies exist
-- =============================================================================

SELECT 
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'webhook_deliveries'
ORDER BY policyname;

-- Expected: Empty result (no policies)

-- =============================================================================
-- TEST: Insert delivery record with service role (manual verification)
-- =============================================================================
--
-- Using service role to insert a test delivery record:
--
-- 1. Get a webhook_id from an existing webhook endpoint:
--    SELECT id FROM webhook_endpoints LIMIT 1;
--
-- 2. Insert a test delivery record (using service role):
--    INSERT INTO webhook_deliveries (webhook_id, event_type, payload, response_code, response_body)
--    VALUES (
--      '{webhook_id}',
--      'release.published',
--      '{"event": "release.published", "data": {"test": true}}'::jsonb,
--      200,
--      '{"status": "ok"}'
--    );
--
-- 3. Verify the record was inserted:
--    SELECT * FROM webhook_deliveries WHERE webhook_id = '{webhook_id}';
--    Expected: Row exists with all fields populated
--
-- 4. Verify attempted_at was auto-populated:
--    SELECT id, attempted_at FROM webhook_deliveries WHERE webhook_id = '{webhook_id}';
--    Expected: attempted_at is set to current timestamp

-- =============================================================================
-- TEST: Foreign key constraint works (manual verification)
-- =============================================================================
--
-- Attempt to insert with invalid webhook_id:
-- INSERT INTO webhook_deliveries (webhook_id, event_type, payload)
-- VALUES (
--   '00000000-0000-0000-0000-000000000000',
--   'release.published',
--   '{"test": true}'::jsonb
-- );
-- Expected: Foreign key violation error

-- =============================================================================
-- TEST: CASCADE delete works (manual verification)
-- =============================================================================
--
-- 1. Create a test webhook endpoint
-- 2. Insert delivery records for that webhook
-- 3. Delete the webhook endpoint
-- 4. Verify delivery records were also deleted
--
-- This tests ON DELETE CASCADE foreign key behavior

-- =============================================================================
-- TEST: Response fields can be null (network errors)
-- =============================================================================
--
-- Insert a delivery record with null response (simulating network error):
-- INSERT INTO webhook_deliveries (webhook_id, event_type, payload, response_code, response_body)
-- VALUES (
--   '{webhook_id}',
--   'release.published',
--   '{"event": "release.published"}'::jsonb,
--   NULL,
--   NULL
-- );
-- Expected: Insert succeeds with null response_code and response_body

-- =============================================================================
-- TEST: Query recent deliveries for a webhook
-- =============================================================================
--
-- Query to get last 10 delivery attempts for a webhook:
-- SELECT 
--   id, 
--   event_type, 
--   response_code, 
--   attempted_at
-- FROM webhook_deliveries
-- WHERE webhook_id = '{webhook_id}'
-- ORDER BY attempted_at DESC
-- LIMIT 10;
--
-- This is the query pattern that will be used in the UI to show delivery history
