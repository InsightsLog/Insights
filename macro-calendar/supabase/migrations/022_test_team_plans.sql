-- Test: Verify team plans support (T334)
-- Run this AFTER executing 022_add_team_plans.sql
-- Test steps documented for manual verification

-- =============================================================================
-- VERIFY: plans table has is_team_plan column
-- =============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'plans'
  AND column_name = 'is_team_plan';

-- Expected result (1 row):
-- column_name: is_team_plan
-- data_type: boolean
-- is_nullable: NO
-- column_default: false

-- =============================================================================
-- VERIFY: plans table has seat_price_monthly column
-- =============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'plans'
  AND column_name = 'seat_price_monthly';

-- Expected result (1 row):
-- column_name: seat_price_monthly
-- data_type: integer
-- is_nullable: YES
-- column_default: 0

-- =============================================================================
-- VERIFY: plans table has seat_price_yearly column
-- =============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'plans'
  AND column_name = 'seat_price_yearly';

-- Expected result (1 row):
-- column_name: seat_price_yearly
-- data_type: integer
-- is_nullable: YES
-- column_default: 0

-- =============================================================================
-- VERIFY: plans table has min_seats column
-- =============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'plans'
  AND column_name = 'min_seats';

-- Expected result (1 row):
-- column_name: min_seats
-- data_type: integer
-- is_nullable: YES
-- column_default: 1

-- =============================================================================
-- VERIFY: plans table has max_seats column
-- =============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'plans'
  AND column_name = 'max_seats';

-- Expected result (1 row):
-- column_name: max_seats
-- data_type: integer
-- is_nullable: YES
-- column_default: 100

-- =============================================================================
-- VERIFY: Team Plus plan exists and is configured correctly
-- =============================================================================

SELECT 
    name,
    price_monthly,
    price_yearly,
    api_calls_limit,
    webhook_limit,
    is_team_plan,
    seat_price_monthly,
    seat_price_yearly,
    min_seats,
    max_seats
FROM plans
WHERE name = 'Team Plus';

-- Expected result (1 row):
-- name: Team Plus
-- price_monthly: 1499 ($14.99)
-- price_yearly: 14990 ($149.90)
-- api_calls_limit: 5000
-- webhook_limit: 10
-- is_team_plan: true
-- seat_price_monthly: 799 ($7.99)
-- seat_price_yearly: 7990 ($79.90)
-- min_seats: 2
-- max_seats: 25

-- =============================================================================
-- VERIFY: Team Pro plan exists and is configured correctly
-- =============================================================================

SELECT 
    name,
    price_monthly,
    price_yearly,
    api_calls_limit,
    webhook_limit,
    is_team_plan,
    seat_price_monthly,
    seat_price_yearly,
    min_seats,
    max_seats
FROM plans
WHERE name = 'Team Pro';

-- Expected result (1 row):
-- name: Team Pro
-- price_monthly: 4999 ($49.99)
-- price_yearly: 49990 ($499.90)
-- api_calls_limit: 50000
-- webhook_limit: 50
-- is_team_plan: true
-- seat_price_monthly: 1999 ($19.99)
-- seat_price_yearly: 19990 ($199.90)
-- min_seats: 2
-- max_seats: 100

-- =============================================================================
-- VERIFY: Team Enterprise plan exists and is configured correctly
-- =============================================================================

SELECT 
    name,
    price_monthly,
    price_yearly,
    api_calls_limit,
    webhook_limit,
    is_team_plan,
    seat_price_monthly,
    seat_price_yearly,
    min_seats,
    max_seats
FROM plans
WHERE name = 'Team Enterprise';

-- Expected result (1 row):
-- name: Team Enterprise
-- price_monthly: 14999 ($149.99)
-- price_yearly: 149990 ($1499.90)
-- api_calls_limit: 500000
-- webhook_limit: 200
-- is_team_plan: true
-- seat_price_monthly: 2999 ($29.99)
-- seat_price_yearly: 29990 ($299.90)
-- min_seats: 5
-- max_seats: 1000

-- =============================================================================
-- VERIFY: Individual plans are NOT team plans
-- =============================================================================

SELECT 
    name,
    is_team_plan
FROM plans
WHERE name IN ('Free', 'Plus', 'Pro', 'Enterprise')
ORDER BY price_monthly;

-- Expected result (4 rows, all with is_team_plan = false):
-- name: Free, is_team_plan: false
-- name: Plus, is_team_plan: false
-- name: Pro, is_team_plan: false
-- name: Enterprise, is_team_plan: false

-- =============================================================================
-- VERIFY: All team plans are marked as team plans
-- =============================================================================

SELECT 
    name,
    is_team_plan
FROM plans
WHERE is_team_plan = true
ORDER BY price_monthly;

-- Expected result (3 rows, all team plans):
-- name: Team Plus, is_team_plan: true
-- name: Team Pro, is_team_plan: true
-- name: Team Enterprise, is_team_plan: true
