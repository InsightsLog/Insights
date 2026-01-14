-- Migration: Create organizations table for multi-tenant admin
-- Description: Adds organizations table with unique slugs for URL-friendly org names (L3)
-- Date: 2026-01-14
-- Task: T330

-- Create organizations table
-- Stores organization information for multi-tenant features
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);

-- Add comments for documentation
COMMENT ON TABLE organizations IS 'Organizations for multi-tenant team features';
COMMENT ON COLUMN organizations.id IS 'Unique identifier for the organization';
COMMENT ON COLUMN organizations.name IS 'Display name of the organization';
COMMENT ON COLUMN organizations.slug IS 'URL-friendly unique identifier for the organization';
COMMENT ON COLUMN organizations.owner_id IS 'Reference to the user who owns this organization (FK to profiles)';
COMMENT ON COLUMN organizations.created_at IS 'Timestamp when organization was created';

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can read organizations they own
CREATE POLICY "Users can read own organizations"
    ON organizations FOR SELECT
    USING (auth.uid() = owner_id);

-- RLS Policy: Authenticated users can create organizations (they become the owner)
CREATE POLICY "Users can create organizations"
    ON organizations FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- RLS Policy: Owners can update their organizations
CREATE POLICY "Owners can update own organizations"
    ON organizations FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- RLS Policy: Owners can delete their organizations
CREATE POLICY "Owners can delete own organizations"
    ON organizations FOR DELETE
    USING (auth.uid() = owner_id);
