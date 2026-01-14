-- Test: Add organization billing support
-- Description: Tests for 021_add_org_subscriptions.sql migration
-- Task: T334

-- Test 1: Verify subscriptions table has org_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'org_id'
    ) THEN
        RAISE EXCEPTION 'subscriptions.org_id column does not exist';
    END IF;
    RAISE NOTICE 'Test 1 passed: subscriptions.org_id column exists';
END $$;

-- Test 2: Verify subscriptions table has seat_count column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'seat_count'
    ) THEN
        RAISE EXCEPTION 'subscriptions.seat_count column does not exist';
    END IF;
    RAISE NOTICE 'Test 2 passed: subscriptions.seat_count column exists';
END $$;

-- Test 3: Verify organization_members allows billing_admin role
DO $$
BEGIN
    -- Check that the constraint includes billing_admin
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'organization_members_role_check'
        AND check_clause LIKE '%billing_admin%'
    ) THEN
        RAISE EXCEPTION 'organization_members role constraint does not include billing_admin';
    END IF;
    RAISE NOTICE 'Test 3 passed: billing_admin role is valid in organization_members';
END $$;

-- Test 4: Verify is_org_billing_admin function exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_name = 'is_org_billing_admin'
    ) THEN
        RAISE EXCEPTION 'is_org_billing_admin function does not exist';
    END IF;
    RAISE NOTICE 'Test 4 passed: is_org_billing_admin function exists';
END $$;

-- Test 5: Verify unique index on org_id for subscriptions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'subscriptions' AND indexname = 'idx_subscriptions_org_unique'
    ) THEN
        RAISE EXCEPTION 'idx_subscriptions_org_unique index does not exist';
    END IF;
    RAISE NOTICE 'Test 5 passed: unique index on org_id exists';
END $$;

-- Test 6: Verify RLS policy for organization subscriptions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'subscriptions' 
        AND policyname = 'Users can read own or org subscription'
    ) THEN
        RAISE EXCEPTION 'RLS policy for org subscriptions does not exist';
    END IF;
    RAISE NOTICE 'Test 6 passed: RLS policy for org subscriptions exists';
END $$;

RAISE NOTICE 'All tests passed for 021_add_org_subscriptions.sql';
