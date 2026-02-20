-- Migration: Add Expo push token support to push_subscriptions
-- Description: Adds token_type and expo_token columns; makes endpoint/keys nullable
--              to support Expo push tokens alongside existing web push subscriptions.
-- Date: 2026-02-20
-- Task: T512

-- Add token_type column to distinguish web push vs expo push
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS token_type TEXT NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS expo_token TEXT,
  ALTER COLUMN endpoint DROP NOT NULL,
  ALTER COLUMN keys DROP NOT NULL;

-- Unique index so each user can only register a given Expo token once
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_user_expo_token
  ON push_subscriptions(user_id, expo_token)
  WHERE expo_token IS NOT NULL;

COMMENT ON COLUMN push_subscriptions.token_type IS 'Push subscription type: ''web'' for Web Push Protocol subscriptions, ''expo'' for Expo push tokens (T512)';
COMMENT ON COLUMN push_subscriptions.expo_token IS 'Expo push token (ExponentPushToken[...]) for mobile app notifications (T512)';
