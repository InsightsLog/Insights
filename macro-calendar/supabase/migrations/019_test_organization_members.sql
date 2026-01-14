-- Test: Verify organization_members table (T331)
-- Run this AFTER executing 019_create_organization_members.sql
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
WHERE table_name = 'organization_members'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NO, gen_random_uuid())
-- org_id (uuid, NO, null)
-- user_id (uuid, NO, null)
-- role (text, NO, null)
-- invited_at (timestamp with time zone, NO, now())
-- joined_at (timestamp with time zone, YES, null)

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
WHERE tc.table_name = 'organization_members'
ORDER BY tc.constraint_type, kcu.ordinal_position;

-- Expected constraints:
-- organization_members_pkey (PRIMARY KEY) on id
-- organization_members_org_id_user_id_key (UNIQUE) on org_id, user_id
-- organization_members_org_id_fkey (FOREIGN KEY) on org_id -> organizations(id)
-- organization_members_user_id_fkey (FOREIGN KEY) on user_id -> profiles(id)

-- =============================================================================
-- VERIFY: Check constraint for role values
-- =============================================================================

SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'organization_members'::regclass
  AND contype = 'c';

-- Expected result (1 row):
-- constraint_name: organization_members_role_check
-- constraint_definition: CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))

-- =============================================================================
-- VERIFY: Indexes exist
-- =============================================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'organization_members'
ORDER BY indexname;

-- Expected indexes:
-- organization_members_pkey (unique index on id)
-- organization_members_org_id_user_id_key (unique index on org_id, user_id)
-- idx_organization_members_org_id (index on org_id)
-- idx_organization_members_user_id (index on user_id)
-- idx_organization_members_role (index on role)

-- =============================================================================
-- VERIFY: RLS is enabled
-- =============================================================================

SELECT 
    tablename, 
    rowsecurity
FROM pg_tables
WHERE tablename = 'organization_members';

-- Expected: rowsecurity = true

-- =============================================================================
-- VERIFY: RLS policies
-- =============================================================================

SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'organization_members'
ORDER BY policyname;

-- Expected policies:
-- "Org admins can delete members" for DELETE with qual using is_org_admin(org_id)
-- "Org admins can insert members" for INSERT with with_check using is_org_admin(org_id)
-- "Org admins can update members" for UPDATE with qual and with_check using is_org_admin(org_id)
-- "Org members can read members" for SELECT with qual checking membership

-- =============================================================================
-- VERIFY: Helper function exists
-- =============================================================================

SELECT 
    proname AS function_name,
    prosrc AS function_body
FROM pg_proc
WHERE proname = 'is_org_admin';

-- Expected: Function is_org_admin exists

-- =============================================================================
-- VERIFY: Foreign key relationships
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
WHERE tc.table_name = 'organization_members'
    AND tc.constraint_type = 'FOREIGN KEY';

-- Expected:
-- organization_members_org_id_fkey: org_id -> organizations(id), delete_rule = CASCADE
-- organization_members_user_id_fkey: user_id -> profiles(id), delete_rule = CASCADE

-- =============================================================================
-- VERIFY: Updated organizations RLS policy
-- =============================================================================

SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'organizations'
    AND policyname = 'Org members can read organizations';

-- Expected: Policy exists for SELECT allowing org members to read

-- =============================================================================
-- TEST: Insert organization member (requires service role)
-- =============================================================================
--
-- To test member creation:
--
-- 1. First, ensure you have a test user profile:
--    SELECT id, email FROM profiles LIMIT 1;
--
-- 2. Create an organization for the test user:
--    INSERT INTO organizations (name, slug, owner_id)
--    VALUES ('Test Org', 'test-org-members', '<user_id_from_step_1>')
--    RETURNING id;
--
-- 3. Add the owner as an organization member:
--    INSERT INTO organization_members (org_id, user_id, role, joined_at)
--    VALUES ('<org_id_from_step_2>', '<user_id_from_step_1>', 'owner', NOW());
--
-- 4. Verify the member was created:
--    SELECT * FROM organization_members WHERE org_id = '<org_id>';
--
-- Expected: Member record created with owner role

-- =============================================================================
-- TEST: Role constraint validation
-- =============================================================================
--
-- Try to insert invalid role:
-- INSERT INTO organization_members (org_id, user_id, role)
-- VALUES ('<org_id>', '<user_id>', 'invalid_role');
--
-- Expected: Error - check constraint violation

-- =============================================================================
-- TEST: Unique constraint validation
-- =============================================================================
--
-- Try to add the same user to the same org twice:
-- INSERT INTO organization_members (org_id, user_id, role)
-- VALUES ('<org_id>', '<user_id>', 'member');
--
-- INSERT INTO organization_members (org_id, user_id, role)
-- VALUES ('<org_id>', '<user_id>', 'admin');
--
-- Expected: Second insert fails with unique constraint violation

-- =============================================================================
-- TEST: RLS - Org members can read their organization's members
-- =============================================================================
--
-- Setup:
-- 1. Create an organization and add two members (user A as owner, user B as member)
-- 2. Log in as user B
-- 3. Run: SELECT * FROM organization_members WHERE org_id = '<org_id>';
-- 4. Expected: Both members visible
--
-- 5. Create another organization with user C as owner
-- 6. As user B, run: SELECT * FROM organization_members WHERE org_id = '<other_org_id>';
-- 7. Expected: No rows returned (user B is not a member)

-- =============================================================================
-- TEST: RLS - Org admins can add members
-- =============================================================================
--
-- Setup:
-- 1. Create an organization with user A as owner (also add as owner member)
-- 2. Log in as user A
-- 3. Run: INSERT INTO organization_members (org_id, user_id, role) VALUES ('<org_id>', '<user_B_id>', 'member');
-- 4. Expected: Insert succeeds
--
-- 5. Log in as user B (who is now a member, not admin)
-- 6. Run: INSERT INTO organization_members (org_id, user_id, role) VALUES ('<org_id>', '<user_C_id>', 'member');
-- 7. Expected: Insert fails (user B is not an admin)

-- =============================================================================
-- TEST: RLS - Org admins can update member roles
-- =============================================================================
--
-- As org admin/owner:
-- UPDATE organization_members SET role = 'admin' WHERE user_id = '<member_user_id>' AND org_id = '<org_id>';
--
-- Expected: Role updated successfully
--
-- As regular member:
-- UPDATE organization_members SET role = 'admin' WHERE user_id = auth.uid() AND org_id = '<org_id>';
--
-- Expected: No rows updated (RLS blocks self-promotion)

-- =============================================================================
-- TEST: RLS - Org admins can remove members
-- =============================================================================
--
-- As org admin/owner:
-- DELETE FROM organization_members WHERE user_id = '<member_user_id>' AND org_id = '<org_id>';
--
-- Expected: Member deleted successfully
--
-- As regular member:
-- DELETE FROM organization_members WHERE org_id = '<org_id>';
--
-- Expected: No rows deleted (RLS blocks access)

-- =============================================================================
-- TEST: Cascade delete - deleting organization removes all members
-- =============================================================================
--
-- Via service role:
-- 1. Create an organization with multiple members
-- 2. Delete the organization: DELETE FROM organizations WHERE id = '<org_id>';
-- 3. Verify members are also deleted: SELECT * FROM organization_members WHERE org_id = '<org_id>';
--
-- Expected: All members automatically deleted when organization is deleted

-- =============================================================================
-- TEST: Cascade delete - deleting user removes their memberships
-- =============================================================================
--
-- Via service role:
-- 1. Add a user as member to multiple organizations
-- 2. Delete the user from auth.users (cascades to profiles, then to organization_members)
-- 3. Verify memberships are removed
--
-- Expected: All user's memberships automatically deleted when user is deleted

-- =============================================================================
-- TEST: joined_at tracking for invitations
-- =============================================================================
--
-- Create pending invitation:
-- INSERT INTO organization_members (org_id, user_id, role, joined_at)
-- VALUES ('<org_id>', '<user_id>', 'member', NULL);
--
-- Expected: Member created with invited_at set, joined_at NULL
--
-- Accept invitation:
-- UPDATE organization_members SET joined_at = NOW() WHERE user_id = '<user_id>' AND org_id = '<org_id>';
--
-- Expected: joined_at now set, indicating accepted invitation

-- =============================================================================
-- TEST: Verify table comments
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
WHERE st.relname = 'organization_members'
ORDER BY c.ordinal_position;

-- Expected: Comments exist for id, org_id, user_id, role, invited_at, joined_at columns
