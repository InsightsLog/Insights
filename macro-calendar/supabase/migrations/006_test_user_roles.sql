-- Test: Verify user_roles table and RLS policies (T210)
-- Run this AFTER executing 006_create_user_roles.sql
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
WHERE table_name = 'user_roles'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NO, uuid_generate_v4())
-- user_id (uuid, NO, null)
-- role (text, NO, null)
-- granted_at (timestamp with time zone, NO, now())
-- granted_by (uuid, YES, null)

-- =============================================================================
-- VERIFY: Table constraints
-- =============================================================================

-- Check unique constraint and check constraint exist
SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'user_roles'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Expected: 
-- user_roles_pkey (PRIMARY KEY) on id
-- user_roles_user_unique (UNIQUE) on user_id
-- user_roles_role_check (CHECK) - validates role is 'admin' or 'user'

-- =============================================================================
-- VERIFY: Check constraint for role values
-- =============================================================================

SELECT 
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'user_roles' AND con.contype = 'c';

-- Expected: role IN ('admin', 'user')

-- =============================================================================
-- VERIFY: Indexes exist
-- =============================================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'user_roles'
ORDER BY indexname;

-- Expected indexes:
-- user_roles_pkey
-- user_roles_user_unique
-- idx_user_roles_role
-- idx_user_roles_user_id

-- =============================================================================
-- VERIFY: RLS is enabled
-- =============================================================================

SELECT 
    tablename, 
    rowsecurity
FROM pg_tables
WHERE tablename = 'user_roles';

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
WHERE tablename = 'user_roles'
ORDER BY policyname;

-- Expected policies:
-- "Only admins can delete user roles" (DELETE)
-- "Only admins can insert user roles" (INSERT)
-- "Only admins can read user roles" (SELECT)
-- "Only admins can update user roles" (UPDATE)

-- =============================================================================
-- VERIFY: is_admin() function exists
-- =============================================================================

SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_name = 'is_admin' AND routine_schema = 'public';

-- Expected: is_admin, FUNCTION, DEFINER

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
WHERE tc.table_name = 'user_roles' AND tc.constraint_type = 'FOREIGN KEY';

-- Expected:
-- user_id -> profiles(id) with ON DELETE CASCADE
-- granted_by -> profiles(id) with ON DELETE SET NULL

-- =============================================================================
-- TEST: RLS blocks non-admin users (manual test)
-- =============================================================================
-- 
-- To test RLS policies manually:
-- 
-- Step 1: Bootstrap an admin user (run as service role)
-- --------------------------------------------------------
-- First admin must be created with service role since no admins exist yet:
--
--    INSERT INTO user_roles (user_id, role, granted_by)
--    VALUES ('{first_admin_user_id}', 'admin', NULL);
--
-- This bootstraps the first admin. Subsequent admins can be granted by existing admins.
--
-- Step 2: Test admin can read user_roles
-- --------------------------------------------------------
-- Sign in as the admin user and run:
--
--    SELECT * FROM user_roles;
--    Expected: Returns all rows (admin can read)
--
-- Step 3: Test admin can insert new roles
-- --------------------------------------------------------
-- As admin, grant user role to another user:
--
--    INSERT INTO user_roles (user_id, role, granted_by)
--    VALUES ('{another_user_id}', 'user', auth.uid());
--    Expected: Success (admin can insert)
--
-- Step 4: Test non-admin cannot read user_roles
-- --------------------------------------------------------
-- Sign in as a regular user (with role = 'user'):
--
--    SELECT * FROM user_roles;
--    Expected: Empty result (RLS blocks non-admins)
--
-- Step 5: Test non-admin cannot insert/update/delete
-- --------------------------------------------------------
-- As regular user, try to modify user_roles:
--
--    INSERT INTO user_roles (user_id, role) VALUES ('{some_id}', 'admin');
--    Expected: Fails (RLS blocks non-admins)
--
--    UPDATE user_roles SET role = 'admin' WHERE user_id = '{some_id}';
--    Expected: 0 rows updated (RLS blocks)
--
--    DELETE FROM user_roles WHERE user_id = '{some_id}';
--    Expected: 0 rows deleted (RLS blocks)
--
-- Step 6: Test user without any role entry cannot access
-- --------------------------------------------------------
-- Sign in as a user who has no entry in user_roles:
--
--    SELECT * FROM user_roles;
--    Expected: Empty result (is_admin() returns false)
--
-- Step 7: Test admin can grant admin role to others
-- --------------------------------------------------------
-- As admin, promote a user to admin:
--
--    UPDATE user_roles SET role = 'admin', granted_by = auth.uid()
--    WHERE user_id = '{user_to_promote}';
--    Expected: Success (admin can update)
--
-- Step 8: Test role check constraint
-- --------------------------------------------------------
-- Try to insert an invalid role:
--
--    INSERT INTO user_roles (user_id, role)
--    VALUES ('{some_user_id}', 'superuser');
--    Expected: Fails with check constraint violation
