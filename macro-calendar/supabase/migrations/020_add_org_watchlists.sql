-- Migration: Add organization-scoped watchlists
-- Description: Adds org_id column to watchlist table and updates RLS policies (L3)
-- Date: 2026-01-14
-- Task: T333

-- Add org_id column to watchlist table (nullable for personal watchlists)
ALTER TABLE watchlist ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for efficient org watchlist lookups
CREATE INDEX IF NOT EXISTS idx_watchlist_org_id ON watchlist(org_id);

-- Add comment for documentation
COMMENT ON COLUMN watchlist.org_id IS 'Organization ID for shared watchlists (NULL for personal watchlists)';

-- Helper function to check if the current user is a member of an organization
-- Uses SECURITY DEFINER to bypass RLS when checking organization_members table
CREATE OR REPLACE FUNCTION is_org_member(target_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organization_members
        WHERE org_id = target_org_id
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to support organization watchlists
-- Users can view:
-- 1. Their own personal watchlist items (org_id IS NULL AND user_id = auth.uid())
-- 2. Organization watchlist items for orgs they belong to (org_id IS NOT NULL AND is_org_member(org_id))

-- Drop existing select policy
DROP POLICY IF EXISTS "Users can read own watchlist" ON watchlist;

-- Create new select policy that includes org watchlists
CREATE POLICY "Users can read own and org watchlists"
    ON watchlist FOR SELECT
    USING (
        (org_id IS NULL AND auth.uid() = user_id)
        OR (org_id IS NOT NULL AND is_org_member(org_id))
    );

-- Update insert policy to allow adding to org watchlists (org admins/owners only)
DROP POLICY IF EXISTS "Users can insert own watchlist" ON watchlist;

CREATE POLICY "Users can insert own and org watchlists"
    ON watchlist FOR INSERT
    WITH CHECK (
        (org_id IS NULL AND auth.uid() = user_id)
        OR (org_id IS NOT NULL AND is_org_admin(org_id))
    );

-- Update update policy (included for completeness)
DROP POLICY IF EXISTS "Users can update own watchlist" ON watchlist;

CREATE POLICY "Users can update own and org watchlists"
    ON watchlist FOR UPDATE
    USING (
        (org_id IS NULL AND auth.uid() = user_id)
        OR (org_id IS NOT NULL AND is_org_admin(org_id))
    )
    WITH CHECK (
        (org_id IS NULL AND auth.uid() = user_id)
        OR (org_id IS NOT NULL AND is_org_admin(org_id))
    );

-- Update delete policy to allow removing from org watchlists (org admins/owners only)
DROP POLICY IF EXISTS "Users can delete own watchlist" ON watchlist;

CREATE POLICY "Users can delete own and org watchlists"
    ON watchlist FOR DELETE
    USING (
        (org_id IS NULL AND auth.uid() = user_id)
        OR (org_id IS NOT NULL AND is_org_admin(org_id))
    );

-- Update unique constraint to include org_id
-- Personal watchlists: unique per user + indicator
-- Org watchlists: unique per org + indicator
-- First, drop the existing constraint
ALTER TABLE watchlist DROP CONSTRAINT IF EXISTS watchlist_user_indicator_unique;

-- Create partial unique indexes for the different cases
-- For personal watchlists (org_id IS NULL): unique on user_id + indicator_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_personal_unique 
    ON watchlist(user_id, indicator_id) 
    WHERE org_id IS NULL;

-- For org watchlists (org_id IS NOT NULL): unique on org_id + indicator_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_org_unique 
    ON watchlist(org_id, indicator_id) 
    WHERE org_id IS NOT NULL;
