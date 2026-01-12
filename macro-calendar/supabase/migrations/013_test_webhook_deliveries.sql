-- Test: Verify webhook_deliveries table (T304)
-- Run this AFTER executing 013_create_webhook_deliveries.sql
-- Test steps documented for manual verification

-- =============================================================================
-- SETUP: Verify table structure (run as service role / admin)
-- =============================================================================

-- First, verify the table structure exists
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

-- Check primary key and foreign key constraints exist
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
-- idx_webhook_deliveries_attempted_at
-- idx_webhook_deliveries_webhook_attempted
-- idx_webhook_deliveries_webhook_id

-- =============================================================================
-- VERIFY: RLS is NOT enabled (admin-only access)
-- =============================================================================

SELECT 
    tablename, 
    rowsecurity
FROM pg_tables
WHERE tablename = 'webhook_deliveries';

-- Expected: rowsecurity = false

-- =============================================================================
-- VERIFY: No RLS policies exist (intentionally)
-- =============================================================================

SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'webhook_deliveries'
ORDER BY policyname;

-- Expected: Empty result (no policies)

-- =============================================================================
-- TEST: Delivery attempts logged with status codes (manual test via Edge Function)
-- =============================================================================
-- 
-- To test delivery logging:
-- 
-- 1. Create a webhook endpoint via the UI (/settings/webhooks)
-- 
-- 2. Trigger a release event (INSERT or UPDATE on releases table)
--    This will invoke the send-webhook Edge Function which logs deliveries
--
-- 3. Query the webhook_deliveries table to verify logging:
--    SELECT 
--        wd.id,
--        wd.webhook_id,
--        wd.event_type,
--        wd.response_code,
--        wd.response_body,
--        wd.attempted_at,
--        we.url
--    FROM webhook_deliveries wd
--    JOIN webhook_endpoints we ON wd.webhook_id = we.id
--    ORDER BY wd.attempted_at DESC
--    LIMIT 10;
--
-- Expected: Delivery attempt logged with:
--   - webhook_id: matches the created webhook endpoint
--   - event_type: 'release.published' or 'release.revised'
--   - payload: JSON object with event data
--   - response_code: HTTP status code (200 for success, 4xx/5xx for errors)
--   - response_body: Truncated response from the endpoint
--   - attempted_at: Timestamp of the delivery attempt
--
-- 4. Test with a failing endpoint (e.g., non-existent URL):
--    - response_code should be null or error code
--    - response_body should contain error details
--
-- 5. Test the "Test" button in the UI:
--    - A delivery with event_type = 'test' should be logged
--    - response_code should match what the UI displays

-- =============================================================================
-- VERIFY: Foreign key cascade delete works
-- =============================================================================
--
-- When a webhook_endpoint is deleted, all its delivery logs should be deleted too:
--
-- 1. Create a test webhook endpoint
-- 2. Trigger some deliveries or use the Test button
-- 3. Verify deliveries exist:
--    SELECT COUNT(*) FROM webhook_deliveries WHERE webhook_id = '{webhook_id}';
--
-- 4. Delete the webhook endpoint
-- 5. Verify deliveries are cascade deleted:
--    SELECT COUNT(*) FROM webhook_deliveries WHERE webhook_id = '{webhook_id}';
--    Expected: 0 rows

-- =============================================================================
-- CLEANUP QUERY (for maintenance/retention)
-- =============================================================================
-- 
-- To clean up old delivery logs (e.g., keep only last 30 days):
-- DELETE FROM webhook_deliveries 
-- WHERE attempted_at < NOW() - INTERVAL '30 days';
