-- Test: Verify organizations table (T330)
-- Run this AFTER executing 018_create_organizations.sql
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
WHERE table_name = 'organizations'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NO, gen_random_uuid())
-- name (text, NO, null)
-- slug (text, NO, null)
-- owner_id (uuid, NO, null)
-- created_at (timestamp with time zone, NO, now())

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
WHERE tc.table_name = 'organizations'
ORDER BY tc.constraint_type, kcu.ordinal_position;

-- Expected constraints:
-- organizations_pkey (PRIMARY KEY) on id
-- organizations_slug_key (UNIQUE) on slug
-- organizations_owner_id_fkey (FOREIGN KEY) on owner_id

-- =============================================================================
-- VERIFY: Indexes exist
-- =============================================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'organizations'
ORDER BY indexname;

-- Expected indexes:
-- organizations_pkey (unique index on id)
-- organizations_slug_key (unique index on slug)
-- idx_organizations_slug (index on slug)
-- idx_organizations_owner_id (index on owner_id)

-- =============================================================================
-- VERIFY: RLS is enabled
-- =============================================================================

SELECT 
    tablename, 
    rowsecurity
FROM pg_tables
WHERE tablename = 'organizations';

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
WHERE tablename = 'organizations'
ORDER BY policyname;

-- Expected policies:
-- "Owners can delete own organizations" for DELETE with qual = (auth.uid() = owner_id)
-- "Owners can update own organizations" for UPDATE with qual = (auth.uid() = owner_id), with_check = (auth.uid() = owner_id)
-- "Users can create organizations" for INSERT with with_check = (auth.uid() = owner_id)
-- "Users can read own organizations" for SELECT with qual = (auth.uid() = owner_id)

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
WHERE tc.table_name = 'organizations'
    AND tc.constraint_type = 'FOREIGN KEY';

-- Expected:
-- organizations_owner_id_fkey: owner_id -> profiles(id), delete_rule = CASCADE

-- =============================================================================
-- TEST: Can create organization (via service role)
-- =============================================================================
--
-- To test organization creation with a test user:
--
-- 1. First, ensure you have a test user profile:
--    SELECT id, email FROM profiles LIMIT 1;
--
-- 2. Insert an organization using service role:
--    INSERT INTO organizations (name, slug, owner_id)
--    VALUES (
--        'Test Organization',
--        'test-org',
--        '<user_id_from_step_1>'
--    );
--
-- 3. Verify the organization was created:
--    SELECT * FROM organizations WHERE slug = 'test-org';
--
-- Expected: Organization record created with correct owner_id and auto-generated id

-- =============================================================================
-- TEST: Unique slug constraint validation
-- =============================================================================
--
-- Try to insert a duplicate slug:
-- INSERT INTO organizations (name, slug, owner_id)
-- VALUES ('Another Org', 'test-org', '<user_id>');
--
-- Expected: Error - duplicate key value violates unique constraint "organizations_slug_key"

-- =============================================================================
-- TEST: RLS - User can only read own organizations
-- =============================================================================
--
-- As an authenticated user, try to read another user's organization:
--
-- 1. Create organizations for two different users (via service role)
-- 2. Log in as user A
-- 3. Run: SELECT * FROM organizations;
-- 4. Expected: Only user A's organizations are returned
--
-- 5. Try to read user B's organization directly:
--    SELECT * FROM organizations WHERE owner_id = '<user_B_id>';
-- 6. Expected: No rows returned (RLS blocks access)

-- =============================================================================
-- TEST: User can create their own organization
-- =============================================================================
--
-- As an authenticated user:
-- INSERT INTO organizations (name, slug, owner_id)
-- VALUES ('My Organization', 'my-org', auth.uid());
--
-- Expected: Organization created successfully

-- =============================================================================
-- TEST: User cannot create organization for another user
-- =============================================================================
--
-- As an authenticated user, try to create an organization for another user:
-- INSERT INTO organizations (name, slug, owner_id)
-- VALUES ('Fake Org', 'fake-org', '<other_user_id>');
--
-- Expected: Error - violates RLS policy (owner_id must match auth.uid())

-- =============================================================================
-- TEST: Owner can update own organization
-- =============================================================================
--
-- As an authenticated user who owns an organization:
-- UPDATE organizations SET name = 'Updated Name' WHERE owner_id = auth.uid();
--
-- Expected: Organization name updated successfully

-- =============================================================================
-- TEST: User cannot update another user's organization
-- =============================================================================
--
-- As an authenticated user, try to update another user's organization:
-- UPDATE organizations SET name = 'Hacked' WHERE owner_id = '<other_user_id>';
--
-- Expected: No rows updated (RLS blocks access)

-- =============================================================================
-- TEST: Owner can delete own organization
-- =============================================================================
--
-- As an authenticated user who owns an organization:
-- DELETE FROM organizations WHERE owner_id = auth.uid() AND slug = 'my-org';
--
-- Expected: Organization deleted successfully

-- =============================================================================
-- TEST: User cannot delete another user's organization
-- =============================================================================
--
-- As an authenticated user, try to delete another user's organization:
-- DELETE FROM organizations WHERE owner_id = '<other_user_id>';
--
-- Expected: No rows deleted (RLS blocks access)

-- =============================================================================
-- TEST: Cascade delete - deleting user removes their organizations
-- =============================================================================
--
-- Via service role:
-- 1. Create a test user and profile
-- 2. Create an organization for that user
-- 3. Delete the user from auth.users (cascades to profiles, then to organizations)
-- 4. Verify organization is also deleted
--
-- Expected: Organization automatically deleted when owner is deleted

-- =============================================================================
-- TEST: Slug validation (URL-friendly)
-- =============================================================================
--
-- Insert organizations with various slugs:
-- INSERT INTO organizations (name, slug, owner_id) VALUES ('Test', 'valid-slug', '<user_id>');
-- Expected: Success
--
-- INSERT INTO organizations (name, slug, owner_id) VALUES ('Test', 'test-123', '<user_id>');
-- Expected: Success
--
-- INSERT INTO organizations (name, slug, owner_id) VALUES ('Test', 'my_org', '<user_id>');
-- Expected: Success (underscores allowed, but hyphens preferred)
--
-- Note: Slug format validation should be done at the application layer
-- Database only enforces uniqueness

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
WHERE st.relname = 'organizations'
ORDER BY c.ordinal_position;

-- Expected: Comments exist for id, name, slug, owner_id, created_at columns
