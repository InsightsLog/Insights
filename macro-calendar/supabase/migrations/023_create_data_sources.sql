-- Migration: 023_create_data_sources
-- Task: T407
-- Description: Create data_sources and sync_logs tables for automated data acquisition

-- Create data_sources table
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('scraper', 'api')),
  base_url TEXT NOT NULL,
  auth_config JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for enabled data sources
CREATE INDEX idx_data_sources_enabled ON data_sources(enabled) WHERE enabled = true;

-- Create sync_logs table
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for querying recent sync logs by data source
CREATE INDEX idx_sync_logs_data_source ON sync_logs(data_source_id, started_at DESC);
CREATE INDEX idx_sync_logs_status ON sync_logs(status, started_at DESC);

-- Add indicator_series_id column to indicators table to map to external data sources
-- This will store the series ID from the data source (e.g., FRED series ID, BLS series ID)
ALTER TABLE indicators 
  ADD COLUMN IF NOT EXISTS series_id TEXT,
  ADD COLUMN IF NOT EXISTS data_source_name TEXT;

-- Index for looking up indicators by series_id and data source
CREATE INDEX IF NOT EXISTS idx_indicators_series_id ON indicators(data_source_name, series_id) WHERE series_id IS NOT NULL;

-- Add comment explaining the schema
COMMENT ON TABLE data_sources IS 'Configuration for external data sources (FRED, BLS, ECB, scrapers)';
COMMENT ON TABLE sync_logs IS 'Audit trail for data synchronization operations';
COMMENT ON COLUMN indicators.series_id IS 'External data source series ID (e.g., CPIAUCSL for FRED CPI)';
COMMENT ON COLUMN indicators.data_source_name IS 'Name of the data source this indicator maps to (FRED, BLS, ECB)';
