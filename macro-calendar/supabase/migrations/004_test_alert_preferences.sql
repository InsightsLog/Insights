-- Test: Verify alert_preferences table and RLS policies (T200)
-- Run this AFTER executing 004_create_alert_preferences.sql
-- Test steps documented for manual verification

-- =============================================================================
-- SETUP: Create test data (run as service role / admin)
-- =============================================================================

-- First, verify the table structure exists
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'alert_preferences'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NO, uuid_generate_v4())
-- user_id (uuid, NO, null)
-- indicator_id (uuid, NO, null)
-- email_enabled (boolean, NO, false)
-- created_at (timestamp with time zone, NO, now())
-- updated_at (timestamp with time zone, NO, now())

-- =============================================================================
-- VERIFY: Table constraints
-- =============================================================================

-- Check unique constraint exists
SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'alert_preferences'
ORDER BY tc.constraint_type, kcu.ordinal_position;

-- Expected: 
-- alert_preferences_pkey (PRIMARY KEY) on id
-- alert_preferences_user_indicator_unique (UNIQUE) on user_id, indicator_id

-- =============================================================================
-- VERIFY: Indexes exist
-- =============================================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'alert_preferences'
ORDER BY indexname;

-- Expected indexes:
-- alert_preferences_pkey
-- alert_preferences_user_indicator_unique
-- idx_alert_preferences_email_enabled
-- idx_alert_preferences_indicator_id
-- idx_alert_preferences_user_id

-- =============================================================================
-- VERIFY: RLS is enabled
-- =============================================================================

SELECT 
    tablename, 
    rowsecurity
FROM pg_tables
WHERE tablename = 'alert_preferences';

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
WHERE tablename = 'alert_preferences'
ORDER BY policyname;

-- Expected policies:
-- "Users can delete own alert preferences" (DELETE)
-- "Users can insert own alert preferences" (INSERT)
-- "Users can read own alert preferences" (SELECT)
-- "Users can update own alert preferences" (UPDATE)

-- =============================================================================
-- VERIFY: Trigger exists for updated_at
-- =============================================================================

SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'alert_preferences';

-- Expected: update_alert_preferences_updated_at trigger on UPDATE

-- =============================================================================
-- TEST: RLS blocks other users (manual test)
-- =============================================================================
-- 
-- To test RLS policies manually:
-- 
-- 1. Sign in as User A (get a JWT token)
-- 2. Insert an alert preference for User A:
--    INSERT INTO alert_preferences (user_id, indicator_id, email_enabled)
--    VALUES ('{user_a_id}', '{some_indicator_id}', true);
--
-- 3. Sign in as User B (get a different JWT token)
-- 4. Try to SELECT User A's preference:
--    SELECT * FROM alert_preferences WHERE user_id = '{user_a_id}';
--    Expected: Empty result (RLS blocks)
--
-- 5. Try to UPDATE User A's preference:
--    UPDATE alert_preferences SET email_enabled = false WHERE user_id = '{user_a_id}';
--    Expected: 0 rows updated (RLS blocks)
--
-- 6. Try to DELETE User A's preference:
--    DELETE FROM alert_preferences WHERE user_id = '{user_a_id}';
--    Expected: 0 rows deleted (RLS blocks)
--
-- 7. User B can only manage their own preferences:
--    INSERT INTO alert_preferences (user_id, indicator_id, email_enabled)
--    VALUES ('{user_b_id}', '{some_indicator_id}', true);
--    Expected: Success
--
--    SELECT * FROM alert_preferences WHERE user_id = '{user_b_id}';
--    Expected: Returns User B's row only
