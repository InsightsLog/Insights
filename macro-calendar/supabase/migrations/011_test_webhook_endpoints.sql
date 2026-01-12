-- Test: Verify webhook_endpoints table and RLS policies (T300)
-- Run this AFTER executing 011_create_webhook_endpoints.sql
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
WHERE table_name = 'webhook_endpoints'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NO, gen_random_uuid())
-- user_id (uuid, NO, null)
-- url (text, NO, null)
-- secret (text, NO, null)
-- events (ARRAY, NO, '{release.published}'::text[])
-- enabled (boolean, NO, true)
-- created_at (timestamp with time zone, NO, now())
-- updated_at (timestamp with time zone, NO, now())
-- last_triggered_at (timestamp with time zone, YES, null)

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
WHERE tc.table_name = 'webhook_endpoints'
ORDER BY tc.constraint_type, kcu.ordinal_position;

-- Expected: 
-- webhook_endpoints_pkey (PRIMARY KEY) on id
-- webhook_endpoints_user_id_fkey (FOREIGN KEY) on user_id

-- =============================================================================
-- VERIFY: Indexes exist
-- =============================================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'webhook_endpoints'
ORDER BY indexname;

-- Expected indexes:
-- webhook_endpoints_pkey
-- idx_webhook_endpoints_enabled
-- idx_webhook_endpoints_events
-- idx_webhook_endpoints_user_id

-- =============================================================================
-- VERIFY: RLS is enabled
-- =============================================================================

SELECT 
    tablename, 
    rowsecurity
FROM pg_tables
WHERE tablename = 'webhook_endpoints';

-- Expected: rowsecurity = true

-- =============================================================================
-- VERIFY: RLS policies exist
-- =============================================================================

SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'webhook_endpoints'
ORDER BY policyname;

-- Expected policies:
-- "Users can delete own webhooks" (DELETE)
-- "Users can insert own webhooks" (INSERT)
-- "Users can read own webhooks" (SELECT)
-- "Users can update own webhooks" (UPDATE)

-- =============================================================================
-- VERIFY: Trigger exists for updated_at
-- =============================================================================

SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'webhook_endpoints';

-- Expected: update_webhook_endpoints_updated_at trigger on UPDATE

-- =============================================================================
-- VERIFY: Default events array
-- =============================================================================

-- The events column should default to '{release.published}'
-- This can be verified by inserting a row without specifying events
-- (would need to do with service role to bypass RLS)

-- =============================================================================
-- TEST: RLS blocks other users (manual test)
-- =============================================================================
-- 
-- To test RLS policies manually:
-- 
-- 1. Sign in as User A (get a JWT token)
-- 2. Insert a webhook endpoint for User A:
--    INSERT INTO webhook_endpoints (user_id, url, secret, events)
--    VALUES ('{user_a_id}', 'https://example.com/webhook', 'secret123', '{release.published}');
--
-- 3. Sign in as User B (get a different JWT token)
-- 4. Try to SELECT User A's webhook:
--    SELECT * FROM webhook_endpoints WHERE user_id = '{user_a_id}';
--    Expected: Empty result (RLS blocks)
--
-- 5. Try to UPDATE User A's webhook:
--    UPDATE webhook_endpoints SET url = 'https://attacker.com/steal' WHERE user_id = '{user_a_id}';
--    Expected: 0 rows updated (RLS blocks)
--
-- 6. Try to DELETE User A's webhook:
--    DELETE FROM webhook_endpoints WHERE user_id = '{user_a_id}';
--    Expected: 0 rows deleted (RLS blocks)
--
-- 7. User B can only manage their own webhooks:
--    INSERT INTO webhook_endpoints (user_id, url, secret, events)
--    VALUES ('{user_b_id}', 'https://userb.com/webhook', 'secret456', '{release.published,release.revised}');
--    Expected: Success
--
--    SELECT * FROM webhook_endpoints WHERE user_id = '{user_b_id}';
--    Expected: Returns User B's row only
--
-- 8. User B can update their own webhook:
--    UPDATE webhook_endpoints SET enabled = false WHERE user_id = '{user_b_id}';
--    Expected: 1 row updated
--
-- 9. User B can delete their own webhook:
--    DELETE FROM webhook_endpoints WHERE user_id = '{user_b_id}';
--    Expected: 1 row deleted
