-- Migration: Create audit_log table for admin action tracking
-- Description: Adds audit_log table without RLS for admin-only access via service role (L2)
-- Date: 2026-01-10
-- Task: T211

-- Create audit_log table
-- Stores audit trail of admin actions for security and compliance
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('upload', 'role_change', 'delete')),
    resource_type TEXT NOT NULL,
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
-- Index for looking up audit entries by user
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
-- Index for looking up audit entries by action type
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
-- Index for looking up audit entries by resource
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
-- Index for time-based queries (e.g., recent activity)
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE audit_log IS 'Audit trail of admin actions (upload, role_change, delete). No RLS - access via service role only.';

-- NOTE: Row Level Security is NOT enabled on this table
-- Access is restricted to service role only (used by server-side code)
-- Regular authenticated users cannot access this table directly
-- This is intentional for security - audit logs should be tamper-proof
