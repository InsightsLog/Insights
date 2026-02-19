-- Migration: Create push_subscriptions table for web push notifications
-- Description: Adds push_subscriptions table with RLS policies (L4, T420)
-- Date: 2026-02-19
-- Task: T420

-- Create push_subscriptions table
-- Stores browser push subscription objects (endpoint + keys) per user/device
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    keys JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, endpoint)
);

-- Index for looking up subscriptions by user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Add comment for documentation
COMMENT ON TABLE push_subscriptions IS 'Browser push subscription records per user device for web push notifications (T420)';

-- Enable Row Level Security
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only manage their own push subscriptions

-- Select policy: users can read only their own subscriptions
CREATE POLICY "Users can read own push subscriptions"
    ON push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Insert policy: users can insert only their own subscriptions
CREATE POLICY "Users can insert own push subscriptions"
    ON push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Delete policy: users can delete only their own subscriptions
CREATE POLICY "Users can delete own push subscriptions"
    ON push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

-- Revoke direct access from anon and authenticated roles; service_role retains full access
REVOKE ALL ON push_subscriptions FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON push_subscriptions TO authenticated;
