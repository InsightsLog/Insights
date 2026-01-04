-- T010: Create Supabase tables (indicators, releases) + indexes
-- As defined in SPEC.md

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: indicators
CREATE TABLE IF NOT EXISTS indicators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                   -- e.g., "CPI (YoY)"
  country_code TEXT NOT NULL,           -- e.g., "US"
  category TEXT NOT NULL,               -- e.g., "Inflation"
  source_name TEXT NOT NULL,            -- e.g., "BLS"
  source_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: releases
CREATE TABLE IF NOT EXISTS releases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  indicator_id UUID NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  release_at TIMESTAMPTZ NOT NULL,      -- scheduled time
  period TEXT NOT NULL,                 -- e.g., "Dec 2025"
  actual TEXT,
  forecast TEXT,
  previous TEXT,
  revised TEXT,
  unit TEXT,                            -- "%", "Index", etc.
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes as defined in SPEC.md
CREATE INDEX IF NOT EXISTS idx_releases_release_at ON releases(release_at);
CREATE INDEX IF NOT EXISTS idx_releases_indicator_release_at ON releases(indicator_id, release_at DESC);
CREATE INDEX IF NOT EXISTS idx_indicators_country_code ON indicators(country_code);
CREATE INDEX IF NOT EXISTS idx_indicators_category ON indicators(category);
