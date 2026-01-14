-- Migration: Add organization billing support
-- Description: Extends subscriptions table to support organization-level billing (L3)
-- Date: 2026-01-14
-- Task: T334

-- Add org_id column to subscriptions table
-- NULL for personal subscriptions, organization ID for team subscriptions
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add seat_count column for team subscriptions (number of seats purchased)
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS seat_count INTEGER DEFAULT 1;

-- Add index for org_id lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(org_id);

-- Add unique constraint to ensure only one subscription per organization
-- (There should be only one active subscription per org)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_org_unique
ON subscriptions(org_id)
WHERE org_id IS NOT NULL;

-- Add comments for new columns
COMMENT ON COLUMN subscriptions.org_id IS 'Reference to organization for team subscriptions (NULL for personal)';
COMMENT ON COLUMN subscriptions.seat_count IS 'Number of seats purchased for team subscriptions';

-- Add 'billing_admin' as a valid role in organization_members
-- This role can manage organization billing but not other admin functions
-- Update the CHECK constraint on the role column
ALTER TABLE organization_members
DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members
ADD CONSTRAINT organization_members_role_check
CHECK (role IN ('owner', 'admin', 'billing_admin', 'member'));

COMMENT ON COLUMN organization_members.role IS 'Member role: owner, admin, billing_admin, or member';

-- Update RLS policies for subscriptions to allow organization access

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can read own subscription" ON subscriptions;

-- Create new policy that allows reading personal subscriptions and org subscriptions
CREATE POLICY "Users can read own or org subscription"
    ON subscriptions FOR SELECT
    USING (
        -- Personal subscription: user_id matches
        (org_id IS NULL AND auth.uid() = user_id)
        OR
        -- Organization subscription: user is a member of the org
        (org_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.org_id = subscriptions.org_id
            AND organization_members.user_id = auth.uid()
        ))
    );

-- Helper function to check if user is billing admin for an organization
-- Uses SECURITY DEFINER to bypass RLS when checking organization_members table
-- Returns FALSE if auth.uid() is null or target_org_id is null (safe default)
CREATE OR REPLACE FUNCTION is_org_billing_admin(target_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Return false if org_id is null or user is not authenticated
    IF target_org_id IS NULL OR auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM organization_members
        WHERE org_id = target_org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'billing_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_org_billing_admin IS 'Check if current user can manage billing for an organization';
