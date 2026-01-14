-- Migration: Add team plan support to plans table
-- Description: Extends plans table to support seat-based pricing for teams (L3)
-- Date: 2026-01-14
-- Task: T334

-- Add is_team_plan column to identify team/organization plans
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS is_team_plan BOOLEAN NOT NULL DEFAULT false;

-- Add seat_price column for per-seat pricing (in cents)
-- This is the additional price per seat beyond the base plan price
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS seat_price_monthly INTEGER DEFAULT 0;

-- Add seat_price for yearly billing
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS seat_price_yearly INTEGER DEFAULT 0;

-- Add minimum and maximum seat limits for team plans
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS min_seats INTEGER DEFAULT 1;

ALTER TABLE plans
ADD COLUMN IF NOT EXISTS max_seats INTEGER DEFAULT 100;

-- Add comments for new columns
COMMENT ON COLUMN plans.is_team_plan IS 'Whether this plan is for teams/organizations';
COMMENT ON COLUMN plans.seat_price_monthly IS 'Additional monthly price per seat in cents';
COMMENT ON COLUMN plans.seat_price_yearly IS 'Additional yearly price per seat in cents';
COMMENT ON COLUMN plans.min_seats IS 'Minimum number of seats for team plans';
COMMENT ON COLUMN plans.max_seats IS 'Maximum number of seats for team plans';

-- =============================================================================
-- Update existing plans and add team variants
-- =============================================================================

-- Update existing plans to be individual plans (not team plans)
UPDATE plans
SET is_team_plan = false,
    seat_price_monthly = 0,
    seat_price_yearly = 0
WHERE name IN ('Free', 'Plus', 'Pro', 'Enterprise');

-- Add Team Plus plan (based on Plus with seat pricing)
INSERT INTO plans (
    id,
    name,
    price_monthly,
    price_yearly,
    api_calls_limit,
    webhook_limit,
    features,
    is_team_plan,
    seat_price_monthly,
    seat_price_yearly,
    min_seats,
    max_seats
)
VALUES (
    '00000000-0000-0000-0000-000000000005',
    'Team Plus',
    1499, -- Base price $14.99/month
    14990, -- Base price $149.90/year
    5000, -- 5000 API calls per month (shared across team)
    10, -- 10 webhook endpoints
    '{"email_alerts": true, "api_access": true, "priority_support": true, "team_features": true, "shared_watchlists": true, "support": "email"}'::jsonb,
    true,
    799, -- $7.99 per additional seat/month
    7990, -- $79.90 per additional seat/year
    2, -- Minimum 2 seats
    25 -- Maximum 25 seats
)
ON CONFLICT (name) DO UPDATE SET
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    api_calls_limit = EXCLUDED.api_calls_limit,
    webhook_limit = EXCLUDED.webhook_limit,
    features = EXCLUDED.features,
    is_team_plan = EXCLUDED.is_team_plan,
    seat_price_monthly = EXCLUDED.seat_price_monthly,
    seat_price_yearly = EXCLUDED.seat_price_yearly,
    min_seats = EXCLUDED.min_seats,
    max_seats = EXCLUDED.max_seats;

-- Add Team Pro plan (based on Pro with seat pricing)
INSERT INTO plans (
    id,
    name,
    price_monthly,
    price_yearly,
    api_calls_limit,
    webhook_limit,
    features,
    is_team_plan,
    seat_price_monthly,
    seat_price_yearly,
    min_seats,
    max_seats
)
VALUES (
    '00000000-0000-0000-0000-000000000006',
    'Team Pro',
    4999, -- Base price $49.99/month
    49990, -- Base price $499.90/year
    50000, -- 50000 API calls per month (shared across team)
    50, -- 50 webhook endpoints
    '{"email_alerts": true, "api_access": true, "priority_support": true, "data_export": true, "team_features": true, "shared_watchlists": true, "advanced_analytics": true, "support": "priority"}'::jsonb,
    true,
    1999, -- $19.99 per additional seat/month
    19990, -- $199.90 per additional seat/year
    2, -- Minimum 2 seats
    100 -- Maximum 100 seats
)
ON CONFLICT (name) DO UPDATE SET
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    api_calls_limit = EXCLUDED.api_calls_limit,
    webhook_limit = EXCLUDED.webhook_limit,
    features = EXCLUDED.features,
    is_team_plan = EXCLUDED.is_team_plan,
    seat_price_monthly = EXCLUDED.seat_price_monthly,
    seat_price_yearly = EXCLUDED.seat_price_yearly,
    min_seats = EXCLUDED.min_seats,
    max_seats = EXCLUDED.max_seats;

-- Add Team Enterprise plan (for large organizations)
INSERT INTO plans (
    id,
    name,
    price_monthly,
    price_yearly,
    api_calls_limit,
    webhook_limit,
    features,
    is_team_plan,
    seat_price_monthly,
    seat_price_yearly,
    min_seats,
    max_seats
)
VALUES (
    '00000000-0000-0000-0000-000000000007',
    'Team Enterprise',
    14999, -- Base price $149.99/month
    149990, -- Base price $1499.90/year
    500000, -- 500000 API calls per month (shared across team)
    200, -- 200 webhook endpoints
    '{"email_alerts": true, "api_access": true, "priority_support": true, "data_export": true, "team_features": true, "shared_watchlists": true, "advanced_analytics": true, "dedicated_support": true, "sla": true, "sso": true, "audit_logs": true, "support": "dedicated"}'::jsonb,
    true,
    2999, -- $29.99 per additional seat/month
    29990, -- $299.90 per additional seat/year
    5, -- Minimum 5 seats
    1000 -- Maximum 1000 seats
)
ON CONFLICT (name) DO UPDATE SET
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    api_calls_limit = EXCLUDED.api_calls_limit,
    webhook_limit = EXCLUDED.webhook_limit,
    features = EXCLUDED.features,
    is_team_plan = EXCLUDED.is_team_plan,
    seat_price_monthly = EXCLUDED.seat_price_monthly,
    seat_price_yearly = EXCLUDED.seat_price_yearly,
    min_seats = EXCLUDED.min_seats,
    max_seats = EXCLUDED.max_seats;
