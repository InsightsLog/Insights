-- Test: Verify subscriptions table (T321)
-- Run this AFTER executing 016_create_subscriptions.sql
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
WHERE table_name = 'subscriptions'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NO, gen_random_uuid())
-- user_id (uuid, NO, null)
-- plan_id (uuid, NO, null)
-- stripe_subscription_id (text, YES, null)
-- status (text, NO, null)
-- current_period_end (timestamp with time zone, YES, null)
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
WHERE tc.table_name = 'subscriptions'
ORDER BY tc.constraint_type, kcu.ordinal_position;

-- Expected constraints:
-- subscriptions_pkey (PRIMARY KEY) on id
-- subscriptions_user_id_fkey (FOREIGN KEY) on user_id -> profiles(id)
-- subscriptions_plan_id_fkey (FOREIGN KEY) on plan_id -> plans(id)
-- subscriptions_status_check (CHECK) on status

-- =============================================================================
-- VERIFY: Check constraint for status values
-- =============================================================================

SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'subscriptions'::regclass
  AND contype = 'c';

-- Expected: status IN ('active', 'canceled', 'past_due', 'trialing')

-- =============================================================================
-- VERIFY: Indexes exist
-- =============================================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'subscriptions'
ORDER BY indexname;

-- Expected indexes:
-- subscriptions_pkey (unique index on id)
-- idx_subscriptions_user_id (index on user_id)
-- idx_subscriptions_status (index on status)
-- idx_subscriptions_stripe_id (index on stripe_subscription_id)

-- =============================================================================
-- VERIFY: RLS is enabled
-- =============================================================================

SELECT 
    tablename, 
    rowsecurity
FROM pg_tables
WHERE tablename = 'subscriptions';

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
WHERE tablename = 'subscriptions'
ORDER BY policyname;

-- Expected:
-- "Users can read own subscription" policy for SELECT with qual = (auth.uid() = user_id)

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
WHERE tc.table_name = 'subscriptions'
    AND tc.constraint_type = 'FOREIGN KEY';

-- Expected:
-- subscriptions_user_id_fkey: user_id -> profiles(id), delete_rule = CASCADE
-- subscriptions_plan_id_fkey: plan_id -> plans(id), delete_rule = RESTRICT

-- =============================================================================
-- TEST: Insert subscription record (requires service role or direct SQL)
-- =============================================================================
--
-- To test subscription creation with a test user and plan:
--
-- 1. First, ensure you have a test user profile:
--    SELECT id, email FROM profiles LIMIT 1;
--
-- 2. Get a plan ID (Free plan should exist):
--    SELECT id, name FROM plans WHERE name = 'Free';
--
-- 3. Insert a subscription using service role:
--    INSERT INTO subscriptions (user_id, plan_id, status)
--    VALUES (
--        '<user_id_from_step_1>',
--        '00000000-0000-0000-0000-000000000001', -- Free plan ID
--        'active'
--    );
--
-- 4. Verify the subscription was created:
--    SELECT * FROM subscriptions WHERE user_id = '<user_id>';
--
-- Expected: Subscription record created with active status

-- =============================================================================
-- TEST: Status constraint validation
-- =============================================================================
--
-- As service role, try to insert invalid status:
-- INSERT INTO subscriptions (user_id, plan_id, status)
-- VALUES ('<user_id>', '00000000-0000-0000-0000-000000000001', 'invalid_status');
--
-- Expected: Error - check constraint violation

-- =============================================================================
-- TEST: RLS - User can only read own subscription
-- =============================================================================
--
-- As an authenticated user, try to read another user's subscription:
--
-- 1. Create subscriptions for two different users (via service role)
-- 2. Log in as user A
-- 3. Run: SELECT * FROM subscriptions;
-- 4. Expected: Only user A's subscription is returned
--
-- 5. Try to read user B's subscription directly:
--    SELECT * FROM subscriptions WHERE user_id = '<user_B_id>';
-- 6. Expected: No rows returned (RLS blocks access)

-- =============================================================================
-- TEST: User cannot insert own subscription (no INSERT policy)
-- =============================================================================
--
-- As an authenticated user, try to insert a subscription:
-- INSERT INTO subscriptions (user_id, plan_id, status)
-- VALUES (auth.uid(), '00000000-0000-0000-0000-000000000001', 'active');
--
-- Expected: Error - violates RLS policy (no INSERT policy for regular users)

-- =============================================================================
-- TEST: User cannot update own subscription (no UPDATE policy)
-- =============================================================================
--
-- As an authenticated user, try to update their subscription:
-- UPDATE subscriptions SET status = 'canceled' WHERE user_id = auth.uid();
--
-- Expected: Error - violates RLS policy (no UPDATE policy for regular users)

-- =============================================================================
-- TEST: User cannot delete own subscription (no DELETE policy)
-- =============================================================================
--
-- As an authenticated user, try to delete their subscription:
-- DELETE FROM subscriptions WHERE user_id = auth.uid();
--
-- Expected: Error - violates RLS policy (no DELETE policy for regular users)

-- =============================================================================
-- TEST: Cascade delete - deleting user removes subscription
-- =============================================================================
--
-- Via service role:
-- 1. Create a test user and profile
-- 2. Create a subscription for that user
-- 3. Delete the user from auth.users (cascades to profiles, then to subscriptions)
-- 4. Verify subscription is also deleted
--
-- Expected: Subscription automatically deleted when user is deleted

-- =============================================================================
-- TEST: Restrict delete - cannot delete plan with active subscriptions
-- =============================================================================
--
-- Via service role:
-- 1. Create a subscription referencing a plan
-- 2. Try to delete that plan:
--    DELETE FROM plans WHERE id = '<plan_id>';
--
-- Expected: Error - foreign key violation (RESTRICT prevents deletion)
