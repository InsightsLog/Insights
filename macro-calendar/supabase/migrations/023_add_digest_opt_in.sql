-- Migration: Add weekly digest opt-in and indicator importance level
-- Description: Adds digest_weekly opt-in to alert_preferences and importance to indicators (L4)
-- Date: 2026-02-19
-- Task: T421

-- ---------------------------------------------------------------------------
-- 1. Add importance level to indicators table
-- ---------------------------------------------------------------------------
-- High = major market-moving indicators (e.g. CPI, NFP, GDP, FOMC)
-- Medium = notable indicators tracked by analysts
-- Low  = supplementary / niche indicators
ALTER TABLE indicators
    ADD COLUMN IF NOT EXISTS importance TEXT NOT NULL DEFAULT 'medium'
    CHECK (importance IN ('low', 'medium', 'high'));

COMMENT ON COLUMN indicators.importance IS 'Market impact level: low, medium, or high. High = major market-moving indicators (CPI, NFP, GDP, FOMC).';

-- Partial index used by the weekly digest query to find high-importance indicators
CREATE INDEX IF NOT EXISTS idx_indicators_importance_high
    ON indicators(importance)
    WHERE importance = 'high';

-- ---------------------------------------------------------------------------
-- 2. Add weekly digest opt-in to alert_preferences table
-- ---------------------------------------------------------------------------
-- When a user sets digest_weekly = true for any of their alert_preferences rows
-- they will receive the Monday morning weekly digest email.
ALTER TABLE alert_preferences
    ADD COLUMN IF NOT EXISTS digest_weekly BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN alert_preferences.digest_weekly IS 'User has opted in to the weekly email digest of upcoming high-impact releases.';

-- Partial index to efficiently locate users opted into the weekly digest
CREATE INDEX IF NOT EXISTS idx_alert_preferences_digest_weekly
    ON alert_preferences(user_id)
    WHERE digest_weekly = true;

-- ---------------------------------------------------------------------------
-- 3. pg_cron schedule (requires pg_cron + pg_net extensions enabled)
-- ---------------------------------------------------------------------------
-- Run the following SQL in the Supabase SQL Editor once to schedule the
-- weekly digest edge function every Monday at 06:00 UTC.
--
-- Prerequisites:
--   • Enable pg_cron  in Supabase dashboard → Database → Extensions
--   • Enable pg_net   in Supabase dashboard → Database → Extensions
--   • Set Postgres settings (run once in SQL Editor):
--       ALTER DATABASE postgres SET app.supabase_url = 'https://<project>.supabase.co';
--       ALTER DATABASE postgres SET app.service_role_key = '<service-role-key>';
--
-- Schedule command (run manually, not part of this migration):
--
--   SELECT cron.schedule(
--     'send-weekly-digest',
--     '0 6 * * 1',
--     $$
--     SELECT net.http_post(
--       url     := current_setting('app.supabase_url') || '/functions/v1/send-weekly-digest',
--       headers := jsonb_build_object(
--                    'Content-Type',  'application/json',
--                    'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--                  ),
--       body    := '{}'::jsonb
--     ) AS request_id;
--     $$
--   );
--
-- To unschedule:
--   SELECT cron.unschedule('send-weekly-digest');
