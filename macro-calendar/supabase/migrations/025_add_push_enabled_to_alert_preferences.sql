-- Migration: Add push_enabled column to alert_preferences
-- Description: Adds per-indicator push notification opt-in for the alert preferences settings page (T460)
-- Date: 2026-02-19
-- Task: T460

ALTER TABLE alert_preferences
    ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN alert_preferences.push_enabled IS 'User has enabled push notifications for this specific indicator.';

-- Partial index to efficiently find users with push enabled for an indicator
CREATE INDEX IF NOT EXISTS idx_alert_preferences_push_enabled
    ON alert_preferences(indicator_id, push_enabled)
    WHERE push_enabled = true;
