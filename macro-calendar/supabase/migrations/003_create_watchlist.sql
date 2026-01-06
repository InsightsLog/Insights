-- Migration: Create watchlist table for user saved indicators
-- Description: Adds watchlist table with RLS (L1)
-- Date: 2026-01-06
-- Task: T120

-- Enable uuid-ossp extension for uuid_generate_v4 (id defaults)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    indicator_id UUID NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT watchlist_user_indicator_unique UNIQUE (user_id, indicator_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_created_at ON watchlist(user_id, created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE watchlist IS 'User watchlist entries linking profiles to indicators';

-- Enable Row Level Security (RLS)
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only CRUD their own watchlist items
CREATE POLICY "Users can select own watchlist"
    ON watchlist FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist"
    ON watchlist FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watchlist"
    ON watchlist FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist"
    ON watchlist FOR DELETE
    USING (auth.uid() = user_id);
