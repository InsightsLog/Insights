-- Migration: Create subscriptions table for billing
-- Description: Adds subscriptions table with user-plan relationships (L3)
-- Date: 2026-01-13
-- Task: T321

-- Create subscriptions table
-- Stores user subscription information for billing integration
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    stripe_subscription_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);

-- Add comments for documentation
COMMENT ON TABLE subscriptions IS 'User subscriptions linking users to billing plans';
COMMENT ON COLUMN subscriptions.user_id IS 'Reference to the subscribing user (FK to profiles)';
COMMENT ON COLUMN subscriptions.plan_id IS 'Reference to the subscription plan (FK to plans)';
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 'Stripe subscription ID for payment tracking (nullable for free tier)';
COMMENT ON COLUMN subscriptions.status IS 'Subscription status: active, canceled, past_due, or trialing';
COMMENT ON COLUMN subscriptions.current_period_end IS 'End date of the current billing period (nullable for free tier)';
COMMENT ON COLUMN subscriptions.created_at IS 'Timestamp when subscription was created';

-- Enable Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: users can only read their own subscription
CREATE POLICY "Users can read own subscription"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- NOTE: Subscriptions are managed via Stripe webhooks using service role
-- No INSERT/UPDATE/DELETE policies for regular users - all writes via service role
