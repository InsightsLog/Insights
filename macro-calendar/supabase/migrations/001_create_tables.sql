-- Migration: Create indicators and releases tables
-- Description: Initial schema for macro calendar L0
-- Date: 2026-01-04

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indicators table
CREATE TABLE IF NOT EXISTS indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    country_code TEXT NOT NULL,
    category TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create releases table
CREATE TABLE IF NOT EXISTS releases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    indicator_id UUID NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
    release_at TIMESTAMPTZ NOT NULL,
    period TEXT NOT NULL,
    actual TEXT,
    forecast TEXT,
    previous TEXT,
    revised TEXT,
    unit TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_releases_release_at ON releases(release_at);
CREATE INDEX IF NOT EXISTS idx_releases_indicator_release ON releases(indicator_id, release_at DESC);
CREATE INDEX IF NOT EXISTS idx_indicators_country_code ON indicators(country_code);
CREATE INDEX IF NOT EXISTS idx_indicators_category ON indicators(category);

-- Add comment for documentation
COMMENT ON TABLE indicators IS 'Economic indicators tracked by the macro calendar';
COMMENT ON TABLE releases IS 'Scheduled and historical releases for economic indicators';
