-- Migration: Create webhook_endpoints table for webhook notifications
-- Description: Adds webhook_endpoints table with RLS policies (L3)
-- Date: 2026-01-12
-- Task: T300

-- Create webhook_endpoints table
-- Stores user webhook endpoint configurations for receiving release notifications
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{release.published}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_triggered_at TIMESTAMPTZ
);

-- Create indexes for efficient queries
-- Index for looking up webhooks by user
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_user_id ON webhook_endpoints(user_id);
-- Index for finding enabled webhooks (used when triggering webhooks)
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_enabled ON webhook_endpoints(enabled) WHERE enabled = true;
-- Index for looking up webhooks by event type using GIN for array contains
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_events ON webhook_endpoints USING GIN (events);

-- Add comment for documentation
COMMENT ON TABLE webhook_endpoints IS 'User webhook endpoints for receiving release notifications via HTTP POST';

-- Enable Row Level Security
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only CRUD their own webhook endpoints
-- Select policy: users can read only their own webhooks
CREATE POLICY "Users can read own webhooks"
    ON webhook_endpoints FOR SELECT
    USING (auth.uid() = user_id);

-- Insert policy: users can insert only their own webhooks
CREATE POLICY "Users can insert own webhooks"
    ON webhook_endpoints FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Update policy: users can update only their own webhooks
CREATE POLICY "Users can update own webhooks"
    ON webhook_endpoints FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Delete policy: users can delete only their own webhooks
CREATE POLICY "Users can delete own webhooks"
    ON webhook_endpoints FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger to update updated_at on webhook updates
-- Reuses the existing update_updated_at_column function from 002_create_profiles.sql
CREATE TRIGGER update_webhook_endpoints_updated_at
    BEFORE UPDATE ON webhook_endpoints
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
