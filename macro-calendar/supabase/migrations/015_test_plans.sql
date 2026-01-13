-- Test: Verify plans table (T320)
-- Run this AFTER executing 015_create_plans.sql
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
WHERE table_name = 'plans'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NO, gen_random_uuid())
-- name (text, NO, null)
-- price_monthly (integer, NO, null)
-- price_yearly (integer, YES, null)
-- api_calls_limit (integer, NO, null)
-- webhook_limit (integer, NO, null)
-- features (jsonb, NO, '{}')

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
WHERE tc.table_name = 'plans'
ORDER BY tc.constraint_type, kcu.ordinal_position;

-- Expected: 
-- plans_pkey (PRIMARY KEY) on id
-- plans_name_key (UNIQUE) on name

-- =============================================================================
-- VERIFY: Indexes exist
-- =============================================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'plans'
ORDER BY indexname;

-- Expected indexes:
-- plans_pkey (unique index on id)
-- plans_name_key (unique index on name)
-- idx_plans_name (index on name)

-- =============================================================================
-- VERIFY: RLS is enabled with public read policy
-- =============================================================================

SELECT 
    tablename, 
    rowsecurity
FROM pg_tables
WHERE tablename = 'plans';

-- Expected: rowsecurity = true

-- =============================================================================
-- VERIFY: RLS policies (public read only)
-- =============================================================================

SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'plans'
ORDER BY policyname;

-- Expected: 
-- "Public read plans" policy for SELECT with qual = true

-- =============================================================================
-- TEST: Plans table populated with tiers
-- =============================================================================

SELECT 
    id,
    name,
    price_monthly,
    price_yearly,
    api_calls_limit,
    webhook_limit,
    features
FROM plans
ORDER BY price_monthly ASC;

-- Expected 4 rows:
-- 1. Free:       $0/mo,    NULL/yr,   100 API calls,   1 webhook
-- 2. Plus:       $9.99/mo, $99.90/yr, 1000 API calls,  5 webhooks
-- 3. Pro:        $29.99/mo,$299.90/yr,10000 API calls, 20 webhooks
-- 4. Enterprise: $99.99/mo,$999.90/yr,100000 API calls,100 webhooks

-- =============================================================================
-- TEST: Verify plan count
-- =============================================================================

SELECT COUNT(*) AS plan_count FROM plans;

-- Expected: 4

-- =============================================================================
-- TEST: Verify each plan exists with correct data
-- =============================================================================

-- Free plan
SELECT name, price_monthly, api_calls_limit, webhook_limit 
FROM plans 
WHERE name = 'Free';
-- Expected: Free, 0, 100, 1

-- Plus plan
SELECT name, price_monthly, price_yearly, api_calls_limit, webhook_limit 
FROM plans 
WHERE name = 'Plus';
-- Expected: Plus, 999, 9990, 1000, 5

-- Pro plan
SELECT name, price_monthly, price_yearly, api_calls_limit, webhook_limit 
FROM plans 
WHERE name = 'Pro';
-- Expected: Pro, 2999, 29990, 10000, 20

-- Enterprise plan
SELECT name, price_monthly, price_yearly, api_calls_limit, webhook_limit 
FROM plans 
WHERE name = 'Enterprise';
-- Expected: Enterprise, 9999, 99990, 100000, 100

-- =============================================================================
-- TEST: Verify features JSON structure
-- =============================================================================

SELECT 
    name,
    features->>'support' as support_level,
    features->>'email_alerts' as email_alerts,
    features->>'api_access' as api_access,
    features->>'data_export' as data_export,
    features->>'dedicated_support' as dedicated_support
FROM plans
ORDER BY price_monthly ASC;

-- Expected:
-- Free:       community support, email_alerts, api_access
-- Plus:       email support, email_alerts, api_access, priority_support
-- Pro:        priority support, email_alerts, api_access, priority_support, data_export
-- Enterprise: dedicated support, email_alerts, api_access, priority_support, data_export, dedicated_support, sla

-- =============================================================================
-- TEST: Public read access (anon user simulation)
-- =============================================================================
--
-- As an anonymous user (no auth.uid()):
-- SELECT * FROM plans; 
-- Expected: Returns all 4 plans (public read policy allows this)

-- =============================================================================
-- TEST: Write access blocked for non-admin users
-- =============================================================================
--
-- As an authenticated non-admin user:
-- INSERT INTO plans (name, price_monthly, api_calls_limit, webhook_limit) 
-- VALUES ('Test', 0, 0, 0);
-- Expected: Error - violates RLS policy (no INSERT policy for regular users)
--
-- UPDATE plans SET price_monthly = 0 WHERE name = 'Free';
-- Expected: Error - violates RLS policy (no UPDATE policy for regular users)
--
-- DELETE FROM plans WHERE name = 'Free';
-- Expected: Error - violates RLS policy (no DELETE policy for regular users)

-- =============================================================================
-- VERIFY: Seed data can be re-run safely (idempotent)
-- =============================================================================
--
-- Run the INSERT ... ON CONFLICT statement from 015_create_plans.sql again
-- Expected: No errors, plans remain unchanged (upsert behavior)
