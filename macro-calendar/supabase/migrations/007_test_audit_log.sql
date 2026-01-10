-- Test: Verify audit_log table structure (T211)
-- Run this AFTER executing 007_create_audit_log.sql
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
WHERE table_name = 'audit_log'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NO, uuid_generate_v4())
-- user_id (uuid, YES, null)
-- action (text, NO, null)
-- resource_type (text, NO, null)
-- resource_id (uuid, YES, null)
-- metadata (jsonb, YES, '{}')
-- created_at (timestamp with time zone, NO, now())

-- =============================================================================
-- VERIFY: Table constraints
-- =============================================================================

-- Check primary key and check constraint exist
SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'audit_log'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Expected: 
-- audit_log_pkey (PRIMARY KEY) on id
-- audit_log_action_check (CHECK) - validates action is 'upload', 'role_change', or 'delete'

-- =============================================================================
-- VERIFY: Check constraint for action values
-- =============================================================================

SELECT 
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'audit_log' AND con.contype = 'c';

-- Expected: action IN ('upload', 'role_change', 'delete')

-- =============================================================================
-- VERIFY: Indexes exist
-- =============================================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'audit_log'
ORDER BY indexname;

-- Expected indexes:
-- audit_log_pkey
-- idx_audit_log_action
-- idx_audit_log_created_at
-- idx_audit_log_resource
-- idx_audit_log_user_id

-- =============================================================================
-- VERIFY: RLS is NOT enabled (intentional for audit_log)
-- =============================================================================

SELECT 
    tablename, 
    rowsecurity
FROM pg_tables
WHERE tablename = 'audit_log';

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
WHERE tc.table_name = 'audit_log' AND tc.constraint_type = 'FOREIGN KEY';

-- Expected:
-- user_id -> profiles(id) with ON DELETE SET NULL
-- (SET NULL preserves audit log entries when user is deleted)

-- =============================================================================
-- TEST: Audit log entries can be created (via service role)
-- =============================================================================
--
-- These tests should be run using the service role (not as authenticated user)
-- In production, audit log entries are created by server-side code
--
-- Test 1: Insert an upload audit entry
-- --------------------------------------------------------
--    INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
--    VALUES (
--        '{admin_user_id}',
--        'upload',
--        'releases',
--        '{release_id}',
--        '{"filename": "gdp-data.csv", "row_count": 52}'
--    );
--    Expected: Success
--
-- Test 2: Insert a role_change audit entry
-- --------------------------------------------------------
--    INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
--    VALUES (
--        '{admin_user_id}',
--        'role_change',
--        'user_roles',
--        '{target_user_id}',
--        '{"old_role": "user", "new_role": "admin", "granted_by": "{admin_user_id}"}'
--    );
--    Expected: Success
--
-- Test 3: Insert a delete audit entry
-- --------------------------------------------------------
--    INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
--    VALUES (
--        '{admin_user_id}',
--        'delete',
--        'releases',
--        '{deleted_release_id}',
--        '{"reason": "duplicate entry"}'
--    );
--    Expected: Success
--
-- Test 4: Verify check constraint blocks invalid action
-- --------------------------------------------------------
--    INSERT INTO audit_log (user_id, action, resource_type, resource_id)
--    VALUES ('{admin_user_id}', 'invalid_action', 'releases', '{some_id}');
--    Expected: Fails with check constraint violation
--
-- Test 5: Verify authenticated user cannot access audit_log
-- --------------------------------------------------------
-- Sign in as a regular authenticated user (not using service role):
--    SELECT * FROM audit_log;
--    Expected: Empty result or permission denied
--    (depends on default Supabase permissions; without RLS, 
--     table access is controlled by role grants)
--
-- Test 6: Verify audit entries are immutable (no UPDATE/DELETE policies)
-- --------------------------------------------------------
-- Since there's no RLS, service role can technically update/delete.
-- However, the intent is that audit logs are append-only.
-- Application code should never UPDATE or DELETE audit_log entries.
-- Consider adding a database trigger to prevent modifications in production.
--
-- Test 7: Query audit log with filters (service role)
-- --------------------------------------------------------
--    -- Get all uploads by a specific user
--    SELECT * FROM audit_log 
--    WHERE user_id = '{user_id}' AND action = 'upload'
--    ORDER BY created_at DESC;
--
--    -- Get all role changes in the last 24 hours
--    SELECT * FROM audit_log 
--    WHERE action = 'role_change' AND created_at > NOW() - INTERVAL '24 hours';
--
--    -- Get all actions on a specific resource
--    SELECT * FROM audit_log 
--    WHERE resource_type = 'releases' AND resource_id = '{release_id}';
