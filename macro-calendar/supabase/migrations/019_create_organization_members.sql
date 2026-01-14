-- Migration: Create organization_members table for multi-tenant admin
-- Description: Adds organization_members table with roles and RLS policies (L3)
-- Date: 2026-01-14
-- Task: T331

-- Create organization_members table
-- Stores organization membership with role assignments
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    joined_at TIMESTAMPTZ,
    UNIQUE (org_id, user_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_role ON organization_members(role);

-- Add comments for documentation
COMMENT ON TABLE organization_members IS 'Organization membership with role assignments for multi-tenant features';
COMMENT ON COLUMN organization_members.id IS 'Unique identifier for the membership record';
COMMENT ON COLUMN organization_members.org_id IS 'Reference to the organization (FK to organizations)';
COMMENT ON COLUMN organization_members.user_id IS 'Reference to the member user (FK to profiles)';
COMMENT ON COLUMN organization_members.role IS 'Member role: owner, admin, or member';
COMMENT ON COLUMN organization_members.invited_at IS 'Timestamp when user was invited to the organization';
COMMENT ON COLUMN organization_members.joined_at IS 'Timestamp when user accepted the invitation (null if pending)';

-- Enable Row Level Security
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the current user is an admin or owner of an organization
-- Uses SECURITY DEFINER to bypass RLS when checking organization_members table
-- This is necessary to prevent infinite recursion when the function is called from RLS policies
CREATE OR REPLACE FUNCTION is_org_admin(target_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organization_members
        WHERE org_id = target_org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policy: Org members can read their organization's member list
CREATE POLICY "Org members can read members"
    ON organization_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.org_id = organization_members.org_id
            AND om.user_id = auth.uid()
        )
    );

-- RLS Policy: Org admins and owners can add members
CREATE POLICY "Org admins can insert members"
    ON organization_members FOR INSERT
    WITH CHECK (is_org_admin(org_id));

-- RLS Policy: Org admins and owners can update members (e.g., change roles, set joined_at)
CREATE POLICY "Org admins can update members"
    ON organization_members FOR UPDATE
    USING (is_org_admin(org_id))
    WITH CHECK (is_org_admin(org_id));

-- RLS Policy: Org admins and owners can remove members
CREATE POLICY "Org admins can delete members"
    ON organization_members FOR DELETE
    USING (is_org_admin(org_id));

-- Also update the organizations table RLS to allow org members to read
-- (Currently only owners can read their organizations)
-- Drop existing policy and create expanded one
DROP POLICY IF EXISTS "Users can read own organizations" ON organizations;

CREATE POLICY "Org members can read organizations"
    ON organizations FOR SELECT
    USING (
        auth.uid() = owner_id
        OR EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.org_id = organizations.id
            AND organization_members.user_id = auth.uid()
        )
    );
