-- Migration: Create data_sources and sync_logs tables
-- Description: Database schema for L4 data acquisition feature
-- Date: 2026-01-16
-- Task: T400

-- =============================================================================
-- Table: data_sources
-- =============================================================================
-- Stores configuration for data scrapers and API sources.
-- Examples: ForexFactory (scraper), FRED (api), BLS (api), ECB (api)
-- Admin-only access via service role (no RLS).

CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('scraper', 'api')),
    base_url TEXT NOT NULL,
    auth_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE data_sources IS 'Configuration for data acquisition sources (scrapers and APIs)';
COMMENT ON COLUMN data_sources.id IS 'Unique identifier for the data source';
COMMENT ON COLUMN data_sources.name IS 'Human-readable name (e.g., ForexFactory, FRED, BLS, ECB)';
COMMENT ON COLUMN data_sources.type IS 'Source type: scraper (web scraping) or api (REST API)';
COMMENT ON COLUMN data_sources.base_url IS 'Base URL for the data source';
COMMENT ON COLUMN data_sources.auth_config IS 'API credentials stored as JSONB (encrypted at rest by Supabase)';
COMMENT ON COLUMN data_sources.enabled IS 'Whether this source is active for scheduled syncs';
COMMENT ON COLUMN data_sources.last_sync_at IS 'Timestamp of the most recent successful sync';
COMMENT ON COLUMN data_sources.created_at IS 'When the data source was configured';

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type);
CREATE INDEX IF NOT EXISTS idx_data_sources_enabled ON data_sources(enabled) WHERE enabled = true;

-- =============================================================================
-- Table: sync_logs
-- =============================================================================
-- Logs all sync attempts for monitoring and debugging.
-- Admin-only access via service role (no RLS).

CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'in_progress')),
    records_processed INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Add comments for documentation
COMMENT ON TABLE sync_logs IS 'Log of all data sync attempts for monitoring and debugging';
COMMENT ON COLUMN sync_logs.id IS 'Unique identifier for the sync log entry';
COMMENT ON COLUMN sync_logs.data_source_id IS 'Reference to the data source that was synced';
COMMENT ON COLUMN sync_logs.status IS 'Sync status: success, partial (some records failed), failed, or in_progress';
COMMENT ON COLUMN sync_logs.records_processed IS 'Number of records successfully processed';
COMMENT ON COLUMN sync_logs.error_message IS 'Error message if sync failed or partially failed';
COMMENT ON COLUMN sync_logs.started_at IS 'When the sync started';
COMMENT ON COLUMN sync_logs.completed_at IS 'When the sync completed (null if in_progress or crashed)';

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sync_logs_data_source_id ON sync_logs(data_source_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_data_source_started ON sync_logs(data_source_id, started_at DESC);

-- =============================================================================
-- Seed: Default data sources
-- =============================================================================
-- Pre-configure the expected data sources (disabled by default until API keys are configured)

INSERT INTO data_sources (name, type, base_url, auth_config, enabled)
VALUES
    ('ForexFactory', 'scraper', 'https://www.forexfactory.com/calendar', '{}'::jsonb, false),
    ('Investing.com', 'scraper', 'https://www.investing.com/economic-calendar', '{}'::jsonb, false),
    ('FRED', 'api', 'https://api.stlouisfed.org/fred', '{"api_key": ""}'::jsonb, false),
    ('BLS', 'api', 'https://api.bls.gov/publicAPI/v2', '{"api_key": ""}'::jsonb, false),
    ('ECB', 'api', 'https://sdw-wsrest.ecb.europa.eu/service', '{}'::jsonb, false)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Note: No RLS policies
-- =============================================================================
-- These tables are admin-only and accessed exclusively via service role client.
-- The service role bypasses RLS, so no policies are needed.
-- All access should go through server actions with admin role checks.
