-- Test: Verify organization billing support (T334)
-- Run this AFTER executing 021_add_org_subscriptions.sql
-- Test steps documented for manual verification

-- =============================================================================
-- VERIFY: subscriptions table has org_id column
-- =============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'subscriptions'
  AND column_name = 'org_id';

-- Expected result (1 row):
-- column_name: org_id
-- data_type: uuid
-- is_nullable: YES
-- column_default: null

-- =============================================================================
-- VERIFY: subscriptions table has seat_count column
-- =============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'subscriptions'
  AND column_name = 'seat_count';

-- Expected result (1 row):
-- column_name: seat_count
-- data_type: integer
-- is_nullable: YES
-- column_default: 1

-- =============================================================================
-- VERIFY: organization_members role constraint includes billing_admin
-- =============================================================================

SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'organization_members'::regclass
  AND contype = 'c'
  AND conname = 'organization_members_role_check';

-- Expected result (1 row):
-- constraint_name: organization_members_role_check
-- constraint_definition should include 'billing_admin' in the array
-- Example: CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'billing_admin'::text, 'member'::text])))

-- =============================================================================
-- VERIFY: is_org_billing_admin function exists
-- =============================================================================

SELECT 
    routine_name,
    routine_type,
    data_type AS return_type
FROM information_schema.routines
WHERE routine_name = 'is_org_billing_admin'
  AND routine_schema = 'public';

-- Expected result (1 row):
-- routine_name: is_org_billing_admin
-- routine_type: FUNCTION
-- return_type: boolean

-- =============================================================================
-- VERIFY: Unique index on org_id for subscriptions
-- =============================================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'subscriptions'
  AND indexname = 'idx_subscriptions_org_unique';

-- Expected result (1 row):
-- indexname: idx_subscriptions_org_unique
-- indexdef: CREATE UNIQUE INDEX idx_subscriptions_org_unique ON public.subscriptions USING btree (org_id) WHERE (org_id IS NOT NULL)

-- =============================================================================
-- VERIFY: Index on org_id for subscriptions
-- =============================================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'subscriptions'
  AND indexname = 'idx_subscriptions_org_id';

-- Expected result (1 row):
-- indexname: idx_subscriptions_org_id
-- indexdef: CREATE INDEX idx_subscriptions_org_id ON public.subscriptions USING btree (org_id)

-- =============================================================================
-- VERIFY: RLS policy for organization subscriptions
-- =============================================================================

SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual IS NOT NULL AS has_using_clause
FROM pg_policies
WHERE tablename = 'subscriptions'
  AND policyname = 'Users can read own or org subscription';

-- Expected result (1 row):
-- policyname: Users can read own or org subscription
-- permissive: PERMISSIVE
-- roles: {public}
-- cmd: SELECT
-- has_using_clause: true

-- =============================================================================
-- VERIFY: Foreign key constraint from subscriptions.org_id to organizations
-- =============================================================================

SELECT 
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'subscriptions'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'org_id';

-- Expected result (1 row):
-- constraint_name: subscriptions_org_id_fkey (or similar)
-- column_name: org_id
-- foreign_table_name: organizations
-- foreign_column_name: id
