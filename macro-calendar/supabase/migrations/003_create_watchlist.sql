-- Migration: Create watchlist table for user saved indicators
-- Description: Adds watchlist table with RLS (L1)
-- Date: 2026-01-06
-- Task: T120

-- Enable pgcrypto extension for gen_random_uuid (id defaults)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    indicator_id UUID NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT watchlist_user_indicator_unique UNIQUE (user_id, indicator_id)
);

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
