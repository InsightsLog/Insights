-- Migration: Create database webhook trigger for release alerts
-- Description: Triggers Edge Function when new releases are inserted (L2)
-- Date: 2026-01-10
-- Task: T203
-- 
-- NOTE: This migration creates the database-side webhook trigger.
-- The webhook configuration must also be set up in the Supabase Dashboard:
-- 1. Navigate to Database > Webhooks
-- 2. Create new webhook with:
--    - Name: send-release-alert-webhook
--    - Table: releases
--    - Events: INSERT
--    - Type: Supabase Edge Functions
--    - Function: send-release-alert
--    - Method: POST
--    - Timeout: 5000ms (allows time for email delivery)
--    - Headers: Content-Type: application/json
--
-- Alternatively, if using pg_net extension directly, uncomment the trigger below.
-- The pg_net extension must be enabled for the trigger approach.

-- Enable pg_net extension if not already enabled (required for HTTP triggers)
-- This extension is typically pre-enabled in Supabase projects
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a function to invoke the Edge Function on release insert
-- This uses pg_net for async HTTP requests (non-blocking)
-- 
-- IMPORTANT: Before using this trigger, you must:
-- 1. Deploy the send-release-alert Edge Function
-- 2. Replace <PROJECT_REF> with your actual Supabase project reference
-- 3. Replace <SERVICE_ROLE_KEY> with your service role key (or use Vault)
--
-- For production, consider using Supabase Vault for secrets:
-- SELECT vault.create_secret('service_role_key', '<your-key>');

-- Uncomment to use trigger-based approach instead of Dashboard webhook:
/*
CREATE OR REPLACE FUNCTION public.notify_release_alert()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
  payload JSONB;
BEGIN
  -- Construct the Edge Function URL
  -- Replace <PROJECT_REF> with your actual project reference
  edge_function_url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-release-alert';
  
  -- Get service role key from environment or Vault
  -- For production, use Vault: SELECT vault.read_secret('service_role_key') INTO service_role_key;
  -- For development, you can hardcode temporarily (NOT recommended for production)
  service_role_key := '<SERVICE_ROLE_KEY>';
  
  -- Construct the webhook payload matching Supabase webhook format
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', NULL
  );
  
  -- Send async HTTP request to Edge Function
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := payload::text,
    timeout_milliseconds := 5000
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on releases table
-- Only fires for INSERT events (new releases)
CREATE TRIGGER on_release_insert_notify_alert
  AFTER INSERT ON public.releases
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_release_alert();

-- Add comment for documentation
COMMENT ON FUNCTION public.notify_release_alert() IS 'Triggers email alerts via Edge Function when new releases are inserted';
COMMENT ON TRIGGER on_release_insert_notify_alert ON public.releases IS 'Sends release alert emails to subscribed users (T203)';
*/

-- RECOMMENDED APPROACH: Use Supabase Dashboard webhook configuration
-- The Dashboard approach is preferred because:
-- 1. No hardcoded secrets in SQL
-- 2. Automatic service role auth handling
-- 3. Easier configuration and management
-- 4. Built-in retry logic and monitoring
--
-- To set up via Dashboard:
-- 1. Go to Project Settings > Database > Webhooks
-- 2. Click "Create a new webhook"
-- 3. Configure:
--    - Name: send-release-alert
--    - Table: public.releases  
--    - Events: INSERT
--    - Webhook type: Supabase Edge Functions
--    - Edge Function: send-release-alert
--    - HTTP Method: POST
--    - Timeout: 5000
-- 4. Add header: Content-Type: application/json
-- 5. Enable "Include Auth Header"

-- Add index for efficient webhook payload generation (if not already exists)
-- This helps with quick release lookups during webhook processing
CREATE INDEX IF NOT EXISTS idx_releases_id ON releases(id);

-- Add comment documenting the webhook dependency
COMMENT ON TABLE releases IS 'Scheduled and historical releases for economic indicators. INSERT events trigger send-release-alert Edge Function webhook (T203).';
