-- Test: Verify organization-scoped watchlists
-- Description: Tests for org_id column and updated RLS policies
-- Date: 2026-01-14
-- Task: T333

-- Test 1: Verify org_id column exists on watchlist table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'watchlist' AND column_name = 'org_id'
    ) THEN
        RAISE EXCEPTION 'Column org_id does not exist on watchlist table';
    END IF;
    RAISE NOTICE 'Test 1 passed: org_id column exists';
END $$;

-- Test 2: Verify org_id is nullable
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'watchlist' 
        AND column_name = 'org_id'
        AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'Column org_id should be nullable';
    END IF;
    RAISE NOTICE 'Test 2 passed: org_id column is nullable';
END $$;

-- Test 3: Verify is_org_member function exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'is_org_member'
    ) THEN
        RAISE EXCEPTION 'Function is_org_member does not exist';
    END IF;
    RAISE NOTICE 'Test 3 passed: is_org_member function exists';
END $$;

-- Test 4: Verify index on org_id exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'watchlist' AND indexname = 'idx_watchlist_org_id'
    ) THEN
        RAISE EXCEPTION 'Index idx_watchlist_org_id does not exist';
    END IF;
    RAISE NOTICE 'Test 4 passed: idx_watchlist_org_id index exists';
END $$;

-- Test 5: Verify personal unique index exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'watchlist' AND indexname = 'idx_watchlist_personal_unique'
    ) THEN
        RAISE EXCEPTION 'Index idx_watchlist_personal_unique does not exist';
    END IF;
    RAISE NOTICE 'Test 5 passed: idx_watchlist_personal_unique index exists';
END $$;

-- Test 6: Verify org unique index exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'watchlist' AND indexname = 'idx_watchlist_org_unique'
    ) THEN
        RAISE EXCEPTION 'Index idx_watchlist_org_unique does not exist';
    END IF;
    RAISE NOTICE 'Test 6 passed: idx_watchlist_org_unique index exists';
END $$;

-- Test 7: Verify RLS policies exist
DO $$
BEGIN
    -- Check select policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'watchlist' 
        AND policyname = 'Users can read own and org watchlists'
    ) THEN
        RAISE EXCEPTION 'Select policy for org watchlists does not exist';
    END IF;
    
    -- Check insert policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'watchlist' 
        AND policyname = 'Users can insert own and org watchlists'
    ) THEN
        RAISE EXCEPTION 'Insert policy for org watchlists does not exist';
    END IF;
    
    -- Check update policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'watchlist' 
        AND policyname = 'Users can update own and org watchlists'
    ) THEN
        RAISE EXCEPTION 'Update policy for org watchlists does not exist';
    END IF;
    
    -- Check delete policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'watchlist' 
        AND policyname = 'Users can delete own and org watchlists'
    ) THEN
        RAISE EXCEPTION 'Delete policy for org watchlists does not exist';
    END IF;
    
    RAISE NOTICE 'Test 7 passed: All RLS policies for org watchlists exist';
END $$;

-- Test 8: Verify foreign key constraint on org_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'watchlist'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'org_id'
    ) THEN
        RAISE EXCEPTION 'Foreign key constraint on org_id does not exist';
    END IF;
    RAISE NOTICE 'Test 8 passed: Foreign key constraint on org_id exists';
END $$;

DO $$
BEGIN
    RAISE NOTICE 'All organization-scoped watchlist tests passed!';
END $$;
