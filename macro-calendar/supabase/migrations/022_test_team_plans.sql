-- Test: Add team plan support to plans table
-- Description: Tests for 022_add_team_plans.sql migration
-- Task: T334

-- Test 1: Verify plans table has is_team_plan column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'plans' AND column_name = 'is_team_plan'
    ) THEN
        RAISE EXCEPTION 'plans.is_team_plan column does not exist';
    END IF;
    RAISE NOTICE 'Test 1 passed: plans.is_team_plan column exists';
END $$;

-- Test 2: Verify plans table has seat_price_monthly column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'plans' AND column_name = 'seat_price_monthly'
    ) THEN
        RAISE EXCEPTION 'plans.seat_price_monthly column does not exist';
    END IF;
    RAISE NOTICE 'Test 2 passed: plans.seat_price_monthly column exists';
END $$;

-- Test 3: Verify plans table has seat_price_yearly column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'plans' AND column_name = 'seat_price_yearly'
    ) THEN
        RAISE EXCEPTION 'plans.seat_price_yearly column does not exist';
    END IF;
    RAISE NOTICE 'Test 3 passed: plans.seat_price_yearly column exists';
END $$;

-- Test 4: Verify plans table has min_seats column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'plans' AND column_name = 'min_seats'
    ) THEN
        RAISE EXCEPTION 'plans.min_seats column does not exist';
    END IF;
    RAISE NOTICE 'Test 4 passed: plans.min_seats column exists';
END $$;

-- Test 5: Verify plans table has max_seats column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'plans' AND column_name = 'max_seats'
    ) THEN
        RAISE EXCEPTION 'plans.max_seats column does not exist';
    END IF;
    RAISE NOTICE 'Test 5 passed: plans.max_seats column exists';
END $$;

-- Test 6: Verify Team Plus plan exists and is a team plan
DO $$
DECLARE
    v_plan RECORD;
BEGIN
    SELECT * INTO v_plan FROM plans WHERE name = 'Team Plus';
    IF v_plan IS NULL THEN
        RAISE EXCEPTION 'Team Plus plan does not exist';
    END IF;
    IF v_plan.is_team_plan IS NOT TRUE THEN
        RAISE EXCEPTION 'Team Plus plan is not marked as team plan';
    END IF;
    IF v_plan.seat_price_monthly <= 0 THEN
        RAISE EXCEPTION 'Team Plus plan has no seat price';
    END IF;
    RAISE NOTICE 'Test 6 passed: Team Plus plan exists with correct configuration';
END $$;

-- Test 7: Verify Team Pro plan exists and is a team plan
DO $$
DECLARE
    v_plan RECORD;
BEGIN
    SELECT * INTO v_plan FROM plans WHERE name = 'Team Pro';
    IF v_plan IS NULL THEN
        RAISE EXCEPTION 'Team Pro plan does not exist';
    END IF;
    IF v_plan.is_team_plan IS NOT TRUE THEN
        RAISE EXCEPTION 'Team Pro plan is not marked as team plan';
    END IF;
    RAISE NOTICE 'Test 7 passed: Team Pro plan exists with correct configuration';
END $$;

-- Test 8: Verify Team Enterprise plan exists and is a team plan
DO $$
DECLARE
    v_plan RECORD;
BEGIN
    SELECT * INTO v_plan FROM plans WHERE name = 'Team Enterprise';
    IF v_plan IS NULL THEN
        RAISE EXCEPTION 'Team Enterprise plan does not exist';
    END IF;
    IF v_plan.is_team_plan IS NOT TRUE THEN
        RAISE EXCEPTION 'Team Enterprise plan is not marked as team plan';
    END IF;
    RAISE NOTICE 'Test 8 passed: Team Enterprise plan exists with correct configuration';
END $$;

-- Test 9: Verify individual plans are not marked as team plans
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM plans
    WHERE name IN ('Free', 'Plus', 'Pro', 'Enterprise')
    AND is_team_plan = true;
    
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Individual plans should not be marked as team plans';
    END IF;
    RAISE NOTICE 'Test 9 passed: Individual plans are not team plans';
END $$;

RAISE NOTICE 'All tests passed for 022_add_team_plans.sql';
