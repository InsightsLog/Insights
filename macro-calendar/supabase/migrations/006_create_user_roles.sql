-- Migration: Create user_roles table for role-based admin access
-- Description: Adds user_roles table with RLS policies (L2)
-- Date: 2026-01-10
-- Task: T210

-- Create user_roles table
-- Stores user roles for role-based access control
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    -- Ensure each user can only have one role entry
    CONSTRAINT user_roles_user_unique UNIQUE (user_id)
);

-- Create indexes for efficient queries
-- Index for looking up a user's role
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
-- Index for looking up users by role
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Add comment for documentation
COMMENT ON TABLE user_roles IS 'User roles for role-based access control (admin, user)';

-- Enable Row Level Security
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the current user is an admin
-- Uses SECURITY DEFINER to bypass RLS when checking admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies: only admins can read/write user_roles
-- Select policy: only admins can read user roles
CREATE POLICY "Only admins can read user roles"
    ON user_roles FOR SELECT
    USING ((SELECT public.is_admin()));

-- Insert policy: only admins can insert new user roles
CREATE POLICY "Only admins can insert user roles"
    ON user_roles FOR INSERT
    WITH CHECK ((SELECT public.is_admin()));

-- Update policy: only admins can update user roles
CREATE POLICY "Only admins can update user roles"
    ON user_roles FOR UPDATE
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

-- Delete policy: only admins can delete user roles
CREATE POLICY "Only admins can delete user roles"
    ON user_roles FOR DELETE
    USING ((SELECT public.is_admin()));
