-- Test: Verify request_logs table structure (T222)
-- Run this AFTER executing 009_create_request_logs.sql
-- Test steps documented for manual verification

-- =============================================================================
-- SETUP: Verify the table structure exists
-- =============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'request_logs'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NO, uuid_generate_v4())
-- ip (text, NO, null)
-- user_id (uuid, YES, null)
-- endpoint (text, NO, null)
-- response_code (smallint, NO, null)
-- created_at (timestamp with time zone, NO, now())

-- =============================================================================
-- VERIFY: Table constraints
-- =============================================================================

-- Check primary key exists
SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'request_logs'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Expected: 
-- request_logs_pkey (PRIMARY KEY) on id

-- =============================================================================
-- VERIFY: Indexes exist
-- =============================================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'request_logs'
ORDER BY indexname;

-- Expected indexes:
-- idx_request_logs_created_at
-- idx_request_logs_endpoint_time
-- idx_request_logs_ip
-- idx_request_logs_response_code
-- idx_request_logs_user_id
-- request_logs_pkey

-- =============================================================================
-- VERIFY: RLS is NOT enabled (intentional for request_logs)
-- =============================================================================

SELECT 
    tablename, 
    rowsecurity
FROM pg_tables
WHERE tablename = 'request_logs';

-- Expected: rowsecurity = false
-- Note: RLS is intentionally disabled. Access is via service role only.

-- =============================================================================
-- VERIFY: Foreign key constraints
-- =============================================================================

SELECT 
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'request_logs' AND tc.constraint_type = 'FOREIGN KEY';

-- Expected:
-- user_id -> profiles(id) with ON DELETE SET NULL
-- (SET NULL preserves request logs when user is deleted)

-- =============================================================================
-- TEST: Request log entries can be created (via service role)
-- =============================================================================
--
-- These tests should be run using the service role (not as authenticated user)
-- In production, request log entries are created by server-side middleware
--
-- Test 1: Insert a request log entry (unauthenticated)
-- --------------------------------------------------------
--    INSERT INTO request_logs (ip, endpoint, response_code)
--    VALUES ('192.168.1.1', '/api/releases', 200);
--    Expected: Success
--
-- Test 2: Insert a request log entry (authenticated)
-- --------------------------------------------------------
--    INSERT INTO request_logs (ip, user_id, endpoint, response_code)
--    VALUES (
--        '10.0.0.1',
--        '{user_id}',
--        '/watchlist',
--        200
--    );
--    Expected: Success
--
-- Test 3: Insert a request log entry with error code
-- --------------------------------------------------------
--    INSERT INTO request_logs (ip, endpoint, response_code)
--    VALUES ('192.168.1.100', '/api/admin/upload', 403);
--    Expected: Success
--
-- Test 4: Insert a rate-limited request log entry
-- --------------------------------------------------------
--    INSERT INTO request_logs (ip, endpoint, response_code)
--    VALUES ('192.168.1.100', '/watchlist', 429);
--    Expected: Success
--
-- Test 5: Verify authenticated user cannot access request_logs
-- --------------------------------------------------------
-- Sign in as a regular authenticated user (not using service role):
--    SELECT * FROM request_logs;
--    Expected: Empty result or permission denied
--    (depends on default Supabase permissions; without RLS, 
--     table access is controlled by role grants)
--
-- Test 6: Query request logs for abuse detection (service role)
-- --------------------------------------------------------
--    -- Get all requests from a specific IP in the last hour
--    SELECT * FROM request_logs 
--    WHERE ip = '192.168.1.100' AND created_at > NOW() - INTERVAL '1 hour'
--    ORDER BY created_at DESC;
--
--    -- Get all 429 (rate limited) responses
--    SELECT ip, endpoint, COUNT(*) as count
--    FROM request_logs 
--    WHERE response_code = 429 AND created_at > NOW() - INTERVAL '24 hours'
--    GROUP BY ip, endpoint
--    ORDER BY count DESC;
--
--    -- Get all requests to admin endpoints
--    SELECT * FROM request_logs 
--    WHERE endpoint LIKE '/api/admin%' 
--    ORDER BY created_at DESC;
--
--    -- Identify IPs with high error rates
--    SELECT ip, 
--           COUNT(*) FILTER (WHERE response_code >= 400) as errors,
--           COUNT(*) as total,
--           ROUND(100.0 * COUNT(*) FILTER (WHERE response_code >= 400) / COUNT(*), 2) as error_rate
--    FROM request_logs 
--    WHERE created_at > NOW() - INTERVAL '1 hour'
--    GROUP BY ip
--    HAVING COUNT(*) > 10
--    ORDER BY error_rate DESC;
