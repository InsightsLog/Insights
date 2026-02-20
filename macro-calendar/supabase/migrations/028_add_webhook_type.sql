-- Migration: Add type column to webhook_endpoints table
-- Description: Adds 'type' column to support typed integrations (generic, discord, slack)
-- Date: 2026-02-20
-- Task: T500

ALTER TABLE webhook_endpoints
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'generic';

-- Add check constraint to ensure valid type values
ALTER TABLE webhook_endpoints
  ADD CONSTRAINT webhook_endpoints_type_check
  CHECK (type IN ('generic', 'discord', 'slack'));

COMMENT ON COLUMN webhook_endpoints.type IS 'Webhook type: generic (custom), discord, or slack';
