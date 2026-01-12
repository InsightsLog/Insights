-- Migration: Create webhook_deliveries table for delivery tracking
-- Description: Adds webhook_deliveries table for logging webhook delivery attempts (L3)
-- Date: 2026-01-12
-- Task: T304

-- Create webhook_deliveries table
-- Stores delivery attempts for webhook notifications (admin-only access via service role)
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
-- Index for looking up deliveries by webhook
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
-- Index for querying deliveries by time (for cleanup/retention)
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_attempted_at ON webhook_deliveries(attempted_at DESC);
-- Composite index for webhook + time queries (e.g., "last 10 deliveries for this webhook")
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_attempted ON webhook_deliveries(webhook_id, attempted_at DESC);

-- Add comment for documentation
COMMENT ON TABLE webhook_deliveries IS 'Webhook delivery attempt logs. Admin-only access via service role (no RLS).';
COMMENT ON COLUMN webhook_deliveries.event_type IS 'Event type that triggered the delivery (e.g., release.published, release.revised, test)';
COMMENT ON COLUMN webhook_deliveries.payload IS 'JSON payload that was sent to the webhook endpoint';
COMMENT ON COLUMN webhook_deliveries.response_code IS 'HTTP status code from the endpoint (NULL if request failed before response)';
COMMENT ON COLUMN webhook_deliveries.response_body IS 'Truncated response body from the endpoint (for debugging)';

-- NOTE: No RLS enabled on this table
-- Access is admin-only via service role key in Edge Functions
-- This ensures webhook delivery logs are not exposed to users via the client API
