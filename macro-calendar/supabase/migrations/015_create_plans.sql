-- Migration: Create plans table for subscription tiers
-- Description: Adds plans table with seed data for Free, Plus, Pro, Enterprise tiers (L3)
-- Date: 2026-01-13
-- Task: T320

-- Create plans table
-- Stores subscription plan definitions with pricing and limits
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER,
    api_calls_limit INTEGER NOT NULL,
    webhook_limit INTEGER NOT NULL,
    features JSONB NOT NULL DEFAULT '{}'
);

-- Create index for looking up plans by name
CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);

-- Add comment for documentation
COMMENT ON TABLE plans IS 'Subscription plans with pricing and feature limits';
COMMENT ON COLUMN plans.name IS 'Plan name (Free, Plus, Pro, Enterprise)';
COMMENT ON COLUMN plans.price_monthly IS 'Monthly price in cents (0 for free)';
COMMENT ON COLUMN plans.price_yearly IS 'Yearly price in cents (null if no yearly option)';
COMMENT ON COLUMN plans.api_calls_limit IS 'Monthly API call limit';
COMMENT ON COLUMN plans.webhook_limit IS 'Maximum number of webhook endpoints allowed';
COMMENT ON COLUMN plans.features IS 'JSON object with feature flags and limits';

-- Enable Row Level Security (public read, no write via client)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Public read-only policy (plans are public information)
CREATE POLICY "Public read plans" ON plans FOR SELECT USING (true);

-- NOTE: Plans can only be modified via service role (admin)
-- No INSERT/UPDATE/DELETE policies for regular users

-- =============================================================================
-- Seed data: Insert default plans
-- =============================================================================

INSERT INTO plans (id, name, price_monthly, price_yearly, api_calls_limit, webhook_limit, features)
VALUES 
    (
        '00000000-0000-0000-0000-000000000001',
        'Free',
        0,
        NULL,
        100,
        1,
        '{"email_alerts": true, "api_access": true, "support": "community"}'::jsonb
    ),
    (
        '00000000-0000-0000-0000-000000000002',
        'Plus',
        999,
        9990,
        1000,
        5,
        '{"email_alerts": true, "api_access": true, "priority_support": true, "support": "email"}'::jsonb
    ),
    (
        '00000000-0000-0000-0000-000000000003',
        'Pro',
        2999,
        29990,
        10000,
        20,
        '{"email_alerts": true, "api_access": true, "priority_support": true, "data_export": true, "support": "priority"}'::jsonb
    ),
    (
        '00000000-0000-0000-0000-000000000004',
        'Enterprise',
        9999,
        99990,
        100000,
        100,
        '{"email_alerts": true, "api_access": true, "priority_support": true, "data_export": true, "dedicated_support": true, "sla": true, "support": "dedicated"}'::jsonb
    )
ON CONFLICT (name) DO UPDATE SET
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    api_calls_limit = EXCLUDED.api_calls_limit,
    webhook_limit = EXCLUDED.webhook_limit,
    features = EXCLUDED.features;
