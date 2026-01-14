-- Test: Verify organization-scoped watchlists (T333)
-- Run this AFTER executing 020_add_org_watchlists.sql
-- Test steps documented for manual verification

-- =============================================================================
-- VERIFY: org_id column exists on watchlist table
-- =============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'watchlist' AND column_name = 'org_id';

-- Expected: 1 row
-- org_id (uuid, YES, null)

-- =============================================================================
-- VERIFY: Watchlist table structure (all columns)
-- =============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'watchlist'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NO)
-- user_id (uuid, NO)
-- indicator_id (uuid, NO)
-- created_at (timestamp with time zone, NO)
-- org_id (uuid, YES) -- NEW: nullable for personal watchlists

-- =============================================================================
-- VERIFY: is_org_member helper function exists
-- =============================================================================

SELECT 
    proname AS function_name,
    prosecdef AS security_definer
FROM pg_proc
WHERE proname = 'is_org_member';

-- Expected: 1 row
-- is_org_member, true (security definer enabled)

-- =============================================================================
-- VERIFY: Indexes exist
-- =============================================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'watchlist'
ORDER BY indexname;

-- Expected indexes (should include):
-- idx_watchlist_org_id (index on org_id)
-- idx_watchlist_org_unique (unique index on org_id, indicator_id WHERE org_id IS NOT NULL)
-- idx_watchlist_personal_unique (unique index on user_id, indicator_id WHERE org_id IS NULL)

-- =============================================================================
-- VERIFY: RLS policies for org watchlists
-- =============================================================================

SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'watchlist'
ORDER BY policyname;

-- Expected policies:
-- "Users can delete own and org watchlists" for DELETE
-- "Users can insert own and org watchlists" for INSERT
-- "Users can read own and org watchlists" for SELECT
-- "Users can update own and org watchlists" for UPDATE

-- =============================================================================
-- VERIFY: Foreign key constraint on org_id
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
WHERE tc.table_name = 'watchlist'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'org_id';

-- Expected: 1 row
-- watchlist_org_id_fkey: org_id -> organizations(id), delete_rule = CASCADE

-- =============================================================================
-- VERIFY: RLS is enabled on watchlist table
-- =============================================================================

SELECT 
    tablename, 
    rowsecurity
FROM pg_tables
WHERE tablename = 'watchlist';

-- Expected: rowsecurity = true

-- =============================================================================
-- TEST: Create org watchlist item (via service role)
-- =============================================================================
--
-- To test organization watchlist creation:
--
-- 1. First, ensure you have a test user profile:
--    SELECT id, email FROM profiles LIMIT 1;
--
-- 2. Create an organization for the test user:
--    INSERT INTO organizations (name, slug, owner_id)
--    VALUES ('Test Org', 'test-org-watchlist', '<user_id>')
--    RETURNING id;
--
-- 3. Add the owner as an organization member:
--    INSERT INTO organization_members (org_id, user_id, role, joined_at)
--    VALUES ('<org_id>', '<user_id>', 'owner', NOW());
--
-- 4. Create an org watchlist item (assuming you have an indicator):
--    SELECT id FROM indicators LIMIT 1;
--    INSERT INTO watchlist (user_id, indicator_id, org_id)
--    VALUES ('<user_id>', '<indicator_id>', '<org_id>');
--
-- 5. Verify the org watchlist item was created:
--    SELECT * FROM watchlist WHERE org_id = '<org_id>';
--
-- Expected: Watchlist record created with org_id set

-- =============================================================================
-- TEST: Personal watchlist still works (org_id = NULL)
-- =============================================================================
--
-- Insert a personal watchlist item:
-- INSERT INTO watchlist (user_id, indicator_id)
-- VALUES ('<user_id>', '<indicator_id>');
--
-- Verify org_id is NULL:
-- SELECT * FROM watchlist WHERE user_id = '<user_id>' AND org_id IS NULL;
--
-- Expected: Personal watchlist items have org_id = NULL

-- =============================================================================
-- TEST: Unique constraint - personal watchlist
-- =============================================================================
--
-- Try to add the same indicator to personal watchlist twice:
-- INSERT INTO watchlist (user_id, indicator_id) VALUES ('<user_id>', '<indicator_id>');
-- INSERT INTO watchlist (user_id, indicator_id) VALUES ('<user_id>', '<indicator_id>');
--
-- Expected: Second insert fails with unique constraint violation

-- =============================================================================
-- TEST: Unique constraint - org watchlist
-- =============================================================================
--
-- Try to add the same indicator to org watchlist twice:
-- INSERT INTO watchlist (user_id, indicator_id, org_id) VALUES ('<user_id>', '<indicator_id>', '<org_id>');
-- INSERT INTO watchlist (user_id, indicator_id, org_id) VALUES ('<user_id>', '<indicator_id>', '<org_id>');
--
-- Expected: Second insert fails with unique constraint violation

-- =============================================================================
-- TEST: Same indicator can be in both personal and org watchlists
-- =============================================================================
--
-- Add to personal watchlist:
-- INSERT INTO watchlist (user_id, indicator_id) VALUES ('<user_id>', '<indicator_id>');
--
-- Add same indicator to org watchlist:
-- INSERT INTO watchlist (user_id, indicator_id, org_id) VALUES ('<user_id>', '<indicator_id>', '<org_id>');
--
-- Expected: Both inserts succeed (different unique constraints)

-- =============================================================================
-- TEST: RLS - Org members can read org watchlists
-- =============================================================================
--
-- Setup:
-- 1. Create an organization with user A as owner
-- 2. Add user B as a member
-- 3. Create an org watchlist item
-- 4. Log in as user B
-- 5. Run: SELECT * FROM watchlist WHERE org_id = '<org_id>';
-- 6. Expected: Org watchlist items visible to member
--
-- 7. Log in as user C (not a member)
-- 8. Run: SELECT * FROM watchlist WHERE org_id = '<org_id>';
-- 9. Expected: No rows returned (user C is not a member)

-- =============================================================================
-- TEST: RLS - Only org admins/owners can modify org watchlists
-- =============================================================================
--
-- As regular org member (not admin/owner):
-- INSERT INTO watchlist (user_id, indicator_id, org_id)
-- VALUES (auth.uid(), '<indicator_id>', '<org_id>');
--
-- Expected: Insert fails (RLS blocks - only admins/owners can insert to org watchlist)
--
-- As org admin/owner:
-- INSERT INTO watchlist (user_id, indicator_id, org_id)
-- VALUES (auth.uid(), '<indicator_id>', '<org_id>');
--
-- Expected: Insert succeeds

-- =============================================================================
-- TEST: Cascade delete - deleting organization removes org watchlist items
-- =============================================================================
--
-- Via service role:
-- 1. Create an organization with watchlist items
-- 2. Delete the organization: DELETE FROM organizations WHERE id = '<org_id>';
-- 3. Verify watchlist items are also deleted: SELECT * FROM watchlist WHERE org_id = '<org_id>';
--
-- Expected: All org watchlist items automatically deleted when organization is deleted

-- =============================================================================
-- TEST: Personal watchlist unaffected by org operations
-- =============================================================================
--
-- 1. User has personal watchlist items (org_id IS NULL)
-- 2. User's organization is deleted
-- 3. Verify: SELECT * FROM watchlist WHERE user_id = '<user_id>' AND org_id IS NULL;
--
-- Expected: Personal watchlist items remain intact
