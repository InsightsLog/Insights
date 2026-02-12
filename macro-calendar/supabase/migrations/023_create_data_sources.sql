-- Migration: Create data_sources and sync_logs tables for data acquisition
-- Description: Foundation tables for automated data import from external APIs and scrapers (L4)
-- Date: 2026-02-12
-- Task: T400

-- Create data_sources table
-- Stores configuration for external data providers (FRED, BLS, ECB, ForexFactory, etc.)
CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('scraper', 'api')),
    base_url TEXT NOT NULL,
    auth_config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create sync_logs table
-- Tracks the outcome of each sync attempt per data source
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
    records_processed INT NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type);
CREATE INDEX IF NOT EXISTS idx_data_sources_enabled ON data_sources(enabled);
CREATE INDEX IF NOT EXISTS idx_sync_logs_data_source_id ON sync_logs(data_source_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at DESC);

-- Add comments for documentation
COMMENT ON TABLE data_sources IS 'External data providers for automated economic data import';
COMMENT ON COLUMN data_sources.id IS 'Unique identifier for the data source';
COMMENT ON COLUMN data_sources.name IS 'Display name (e.g., FRED, BLS, ECB, ForexFactory)';
COMMENT ON COLUMN data_sources.type IS 'Source type: scraper (HTML parsing) or api (REST/SDMX)';
COMMENT ON COLUMN data_sources.base_url IS 'Base URL for the data source API or website';
COMMENT ON COLUMN data_sources.auth_config IS 'API credentials and configuration (JSONB, admin-only access)';
COMMENT ON COLUMN data_sources.enabled IS 'Whether automatic sync is enabled for this source';
COMMENT ON COLUMN data_sources.last_sync_at IS 'Timestamp of the most recent successful sync';
COMMENT ON COLUMN data_sources.created_at IS 'Timestamp when the data source was configured';

COMMENT ON TABLE sync_logs IS 'Audit trail of data sync operations per source';
COMMENT ON COLUMN sync_logs.id IS 'Unique identifier for the sync log entry';
COMMENT ON COLUMN sync_logs.data_source_id IS 'Reference to the data source that was synced';
COMMENT ON COLUMN sync_logs.status IS 'Outcome: success, partial (some records failed), or failed';
COMMENT ON COLUMN sync_logs.records_processed IS 'Number of records successfully processed';
COMMENT ON COLUMN sync_logs.error_message IS 'Error details if status is partial or failed';
COMMENT ON COLUMN sync_logs.started_at IS 'When the sync operation began';
COMMENT ON COLUMN sync_logs.completed_at IS 'When the sync operation finished (null if still running)';

-- No RLS on data_sources or sync_logs — admin-only access via service role client
-- These tables are never queried from the browser client
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- No public policies — only service role can read/write
-- Admin access is handled through createSupabaseServiceClient() which bypasses RLS
