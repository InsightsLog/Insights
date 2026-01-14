-- Migration: Create usage_alerts_sent table
-- Description: Tracks which usage threshold alerts have been sent to users (L3)
-- Date: 2026-01-14
-- Task: T325

-- Create usage_alerts_sent table
-- Tracks sent usage alerts to prevent duplicate emails for the same threshold
CREATE TABLE IF NOT EXISTS usage_alerts_sent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    threshold INT NOT NULL CHECK (threshold IN (80, 90, 100)),
    billing_period_start TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index to prevent duplicate alerts for same user/threshold/period
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_alerts_sent_unique 
    ON usage_alerts_sent(user_id, threshold, billing_period_start);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_usage_alerts_sent_user_period 
    ON usage_alerts_sent(user_id, billing_period_start);

-- Add comments for documentation
COMMENT ON TABLE usage_alerts_sent IS 'Tracks sent usage alerts to avoid duplicates';
COMMENT ON COLUMN usage_alerts_sent.user_id IS 'Reference to the user who received the alert';
COMMENT ON COLUMN usage_alerts_sent.threshold IS 'Usage threshold percentage that triggered the alert (80, 90, or 100)';
COMMENT ON COLUMN usage_alerts_sent.billing_period_start IS 'Start of the billing period for this alert';
COMMENT ON COLUMN usage_alerts_sent.sent_at IS 'Timestamp when the alert was sent';

-- Enable Row Level Security
ALTER TABLE usage_alerts_sent ENABLE ROW LEVEL SECURITY;

-- RLS Policy: users can only read their own alerts
CREATE POLICY "Users can read own usage alerts"
    ON usage_alerts_sent FOR SELECT
    USING (auth.uid() = user_id);

-- NOTE: Insert/update is done via service role when sending alerts
