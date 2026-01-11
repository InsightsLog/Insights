-- Migration: Create request_logs table for abuse detection
-- Description: Adds request_logs table to track API requests for security analysis (L2)
-- Date: 2026-01-11
-- Task: T222

-- Create request_logs table
-- Stores request metadata for abuse detection and security monitoring
-- Designed for high-volume inserts with minimal columns for performance
CREATE TABLE IF NOT EXISTS request_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    endpoint TEXT NOT NULL,
    response_code SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
-- Index for looking up requests by IP (primary abuse detection use case)
CREATE INDEX IF NOT EXISTS idx_request_logs_ip ON request_logs(ip);
-- Index for looking up requests by user (identify compromised accounts)
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON request_logs(user_id) WHERE user_id IS NOT NULL;
-- Index for time-based queries (recent activity, time-window analysis)
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at DESC);
-- Composite index for endpoint + time (identify endpoint abuse patterns)
CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint_time ON request_logs(endpoint, created_at DESC);
-- Index for response code analysis (identify error patterns)
CREATE INDEX IF NOT EXISTS idx_request_logs_response_code ON request_logs(response_code) WHERE response_code >= 400;

-- Add comment for documentation
COMMENT ON TABLE request_logs IS 'Request logs for abuse detection and security monitoring. No RLS - access via service role only.';

-- NOTE: Row Level Security is NOT enabled on this table
-- Access is restricted to service role only (used by server-side code)
-- Regular authenticated users cannot access this table directly
-- This is intentional for security - request logs contain sensitive data

-- NOTE: Consider adding a retention policy in production:
-- - Delete logs older than 30-90 days to manage storage
-- - Can use pg_cron or external job to purge old records:
--   DELETE FROM request_logs WHERE created_at < NOW() - INTERVAL '90 days';
