-- Migration: Create data_sources and sync_logs tables
-- Description: Data acquisition infrastructure for L4 (T400)
-- Date: 2026-02-19

-- Create data_sources table
-- Stores configuration for data scrapers and API sources
CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('scraper', 'api')),
    base_url TEXT NOT NULL,
    auth_config JSONB DEFAULT '{}', -- Encrypted API credentials
    enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create sync_logs table
-- Tracks sync history and errors for data sources
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sync_logs_data_source_id ON sync_logs(data_source_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at DESC);

-- Add comments for documentation
COMMENT ON TABLE data_sources IS 'Configuration for data scrapers and API sources (T400)';
COMMENT ON TABLE sync_logs IS 'Sync history and error logs for data sources (T400)';

-- Enable Row Level Security (RLS)
-- Admin-only access via service role
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- No public policies - admin-only access via service role
-- Service role operations bypass RLS, so no SELECT policy needed
