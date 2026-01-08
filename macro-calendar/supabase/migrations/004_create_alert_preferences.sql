-- Migration: Create alert_preferences table for email alerts
-- Description: Adds alert_preferences table with RLS policies (L2)
-- Date: 2026-01-08
-- Task: T200

-- Create alert_preferences table
-- Stores user preferences for email alerts on specific indicators
CREATE TABLE IF NOT EXISTS alert_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    indicator_id UUID NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
    email_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Ensure each user can only have one preference per indicator
    CONSTRAINT alert_preferences_user_indicator_unique UNIQUE (user_id, indicator_id)
);

-- Create indexes for efficient queries
-- Index for looking up a user's alert preferences
CREATE INDEX IF NOT EXISTS idx_alert_preferences_user_id ON alert_preferences(user_id);
-- Index for looking up which users have alerts enabled for an indicator
CREATE INDEX IF NOT EXISTS idx_alert_preferences_indicator_id ON alert_preferences(indicator_id);
-- Partial index for finding users with email alerts enabled for a specific indicator
-- Used by Edge Function (T203) to query: SELECT user_id FROM alert_preferences WHERE indicator_id = ? AND email_enabled = true
-- Leading column is indicator_id because we filter by indicator first to find all subscribed users
CREATE INDEX IF NOT EXISTS idx_alert_preferences_email_enabled ON alert_preferences(indicator_id, email_enabled) WHERE email_enabled = true;

-- Add comment for documentation
COMMENT ON TABLE alert_preferences IS 'User email alert preferences for specific indicators';

-- Enable Row Level Security
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only CRUD their own alert preferences
-- Select policy: users can read only their own alert preferences
CREATE POLICY "Users can read own alert preferences"
    ON alert_preferences FOR SELECT
    USING (auth.uid() = user_id);

-- Insert policy: users can insert only their own alert preferences
CREATE POLICY "Users can insert own alert preferences"
    ON alert_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Update policy: users can update only their own alert preferences
CREATE POLICY "Users can update own alert preferences"
    ON alert_preferences FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Delete policy: users can delete only their own alert preferences
CREATE POLICY "Users can delete own alert preferences"
    ON alert_preferences FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger to update updated_at on preference updates
-- Reuses the existing update_updated_at_column function from 002_create_profiles.sql
CREATE TRIGGER update_alert_preferences_updated_at
    BEFORE UPDATE ON alert_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
