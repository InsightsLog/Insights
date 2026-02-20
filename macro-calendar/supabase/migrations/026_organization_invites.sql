-- Migration: Create organization_invites table for email-based org invitations
-- Description: Adds organization_invites table to support inviting members by email with accept link (L4)
-- Date: 2026-02-19
-- Task: T470

-- Create organization_invites table
-- Stores pending invitations sent to emails that may not yet have accounts
CREATE TABLE IF NOT EXISTS organization_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invited_email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    token TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_organization_invites_org_id ON organization_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_token ON organization_invites(token);
CREATE INDEX IF NOT EXISTS idx_organization_invites_invited_email ON organization_invites(invited_email);

-- Add comments for documentation
COMMENT ON TABLE organization_invites IS 'Pending email invitations to join an organization';
COMMENT ON COLUMN organization_invites.id IS 'Unique identifier for the invitation';
COMMENT ON COLUMN organization_invites.org_id IS 'Reference to the organization (FK to organizations)';
COMMENT ON COLUMN organization_invites.invited_email IS 'Email address of the invited person';
COMMENT ON COLUMN organization_invites.role IS 'Role the invited person will receive: admin or member';
COMMENT ON COLUMN organization_invites.token IS 'Unique random token used in the accept link';
COMMENT ON COLUMN organization_invites.invited_by IS 'Reference to the user who sent the invite (FK to profiles)';
COMMENT ON COLUMN organization_invites.expires_at IS 'When the invite expires (default: 7 days)';
COMMENT ON COLUMN organization_invites.accepted_at IS 'When the invite was accepted (null if pending)';
COMMENT ON COLUMN organization_invites.created_at IS 'Timestamp when invite was created';

-- Enable Row Level Security
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Org admins and owners can view invites for their org
CREATE POLICY "Org admins can read invites"
    ON organization_invites FOR SELECT
    USING (is_org_admin(org_id));

-- RLS Policy: Org admins and owners can create invites
CREATE POLICY "Org admins can insert invites"
    ON organization_invites FOR INSERT
    WITH CHECK (is_org_admin(org_id));

-- RLS Policy: Org admins and owners can delete (revoke) invites
CREATE POLICY "Org admins can delete invites"
    ON organization_invites FOR DELETE
    USING (is_org_admin(org_id));

-- RLS Policy: Service role can update invites (to mark accepted_at)
-- Invite acceptance is handled server-side with service role to avoid
-- requiring the invitee to be an org member before accepting
CREATE POLICY "Service role can update invites"
    ON organization_invites FOR UPDATE
    USING (true)
    WITH CHECK (true);
