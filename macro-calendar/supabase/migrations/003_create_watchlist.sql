-- Migration: Create watchlist table for user saved indicators
-- Description: Adds watchlist table with RLS policies (L1)
-- Date: 2026-01-06
-- Task: T120

-- Create watchlist table
-- Stores user-indicator relationships for saved/watched indicators
CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    indicator_id UUID NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Ensure each user can only save an indicator once
    CONSTRAINT watchlist_user_indicator_unique UNIQUE (user_id, indicator_id)
);

-- Create indexes for efficient queries
-- Index for looking up a user's watchlist
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
-- Index for looking up which users watch an indicator
CREATE INDEX IF NOT EXISTS idx_watchlist_indicator_id ON watchlist(indicator_id);

-- Add comment for documentation
COMMENT ON TABLE watchlist IS 'User watchlist items linking users to indicators they follow';

-- Enable Row Level Security
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only CRUD their own watchlist items
-- Select policy: users can read only their own watchlist items
CREATE POLICY "Users can read own watchlist"
    ON watchlist FOR SELECT
    USING (auth.uid() = user_id);

-- Insert policy: users can insert only their own watchlist items
CREATE POLICY "Users can insert own watchlist"
    ON watchlist FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Update policy: included for completeness, though current schema has no updatable fields
-- Users would typically delete and re-add rather than update
CREATE POLICY "Users can update own watchlist"
    ON watchlist FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Delete policy: users can delete only their own watchlist items
CREATE POLICY "Users can delete own watchlist"
    ON watchlist FOR DELETE
    USING (auth.uid() = user_id);
