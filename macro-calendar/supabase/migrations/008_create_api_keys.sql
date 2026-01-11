-- Migration: Create api_keys table for authenticated users
-- Description: Adds api_keys table for programmatic API access (L2)
-- Date: 2026-01-11
-- Task: T221

-- Create api_keys table
-- Stores API keys for authenticated users to access the API programmatically
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    -- Ensure key_hash is unique (prevents duplicate keys)
    CONSTRAINT api_keys_key_hash_unique UNIQUE (key_hash)
);

-- Create indexes for efficient queries
-- Index for looking up keys by user
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
-- Index for key lookup during API authentication (most critical for performance)
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;
-- Index for filtering active (non-revoked) keys
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_at ON api_keys(revoked_at);

-- Add comment for documentation
COMMENT ON TABLE api_keys IS 'API keys for programmatic access. Users can create and revoke their own keys.';

-- Enable Row Level Security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only manage their own API keys
-- Select policy: users can only read their own keys
CREATE POLICY "Users can read own API keys"
    ON api_keys FOR SELECT
    USING (auth.uid() = user_id);

-- Insert policy: users can only create keys for themselves
CREATE POLICY "Users can create own API keys"
    ON api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Update policy: users can only update their own keys (for revoking)
CREATE POLICY "Users can update own API keys"
    ON api_keys FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Delete policy: users can delete their own keys
-- Note: We use soft delete (revoked_at) for audit purposes, but allow hard delete if needed
CREATE POLICY "Users can delete own API keys"
    ON api_keys FOR DELETE
    USING (auth.uid() = user_id);
