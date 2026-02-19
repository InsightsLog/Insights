-- Migration: Add onboarding_complete to profiles
-- Description: Tracks whether a user has completed the first-run onboarding wizard (T450)
-- Date: 2026-02-19
-- Task: T450

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.onboarding_complete IS 'True once the user has completed the first-run onboarding wizard (T450)';
