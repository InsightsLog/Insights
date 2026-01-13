-- Migration: Add API usage tracking columns to request_logs
-- Description: Adds api_key_id and response_time_ms columns for API usage tracking (L3)
-- Date: 2026-01-13
-- Task: T314

-- Add api_key_id column to request_logs
-- Nullable because not all requests are API requests with keys
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL;

-- Add response_time_ms column to request_logs
-- Tracks response time in milliseconds for performance monitoring
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;

-- Create index for api_key_id lookups (for usage tracking dashboard)
CREATE INDEX IF NOT EXISTS idx_request_logs_api_key_id ON request_logs(api_key_id) WHERE api_key_id IS NOT NULL;

-- Add composite index for api_key usage analysis over time
CREATE INDEX IF NOT EXISTS idx_request_logs_api_key_time ON request_logs(api_key_id, created_at DESC) WHERE api_key_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN request_logs.api_key_id IS 'API key used for this request (null for non-API requests)';
COMMENT ON COLUMN request_logs.response_time_ms IS 'Response time in milliseconds (for API performance tracking)';
