-- Migration: Create webhook_deliveries table for delivery tracking
-- Description: Adds webhook_deliveries table for logging webhook delivery attempts (L3)
-- Date: 2026-01-12
-- Task: T304

-- Create webhook_deliveries table
-- Stores delivery attempts for webhook notifications with status and response details
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_code INTEGER,
    response_body TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
-- Index for looking up deliveries by webhook endpoint
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
-- Index for sorting deliveries by attempt time (most recent first)
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_attempted_at ON webhook_deliveries(attempted_at DESC);
-- Composite index for getting recent deliveries for a specific webhook
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_time ON webhook_deliveries(webhook_id, attempted_at DESC);

-- Add comment for documentation
COMMENT ON TABLE webhook_deliveries IS 'Webhook delivery attempt logs. No RLS - admin-only access via service role.';
COMMENT ON COLUMN webhook_deliveries.id IS 'Unique identifier for the delivery attempt';
COMMENT ON COLUMN webhook_deliveries.webhook_id IS 'Reference to the webhook endpoint';
COMMENT ON COLUMN webhook_deliveries.event_type IS 'Event type that triggered the webhook (e.g., release.published, release.revised)';
COMMENT ON COLUMN webhook_deliveries.payload IS 'JSON payload that was sent to the webhook endpoint';
COMMENT ON COLUMN webhook_deliveries.response_code IS 'HTTP response status code (null if network error)';
COMMENT ON COLUMN webhook_deliveries.response_body IS 'Response body from the webhook endpoint (truncated if too long)';
COMMENT ON COLUMN webhook_deliveries.attempted_at IS 'Timestamp when the delivery was attempted';

-- NOTE: RLS is intentionally NOT enabled on this table
-- This table is accessed only via service role for administrative purposes
-- Users should not have direct access to delivery logs
-- Instead, delivery history should be exposed through server actions that
-- use service role to query on behalf of authenticated users
