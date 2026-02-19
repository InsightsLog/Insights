-- Migration: Add api_keys_limit to plans table
-- Description: Adds per-plan limit for number of API keys a user can create (T461)
-- Date: 2026-02-19
-- Task: T461

-- Add api_keys_limit column with a safe default (3)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS api_keys_limit INTEGER NOT NULL DEFAULT 3;

-- Add comment for documentation
COMMENT ON COLUMN plans.api_keys_limit IS 'Maximum number of API keys a user on this plan can create';

-- Update existing plans with appropriate limits
UPDATE plans SET api_keys_limit = 1 WHERE name = 'Free';
UPDATE plans SET api_keys_limit = 3 WHERE name = 'Plus';
UPDATE plans SET api_keys_limit = 10 WHERE name = 'Pro';
UPDATE plans SET api_keys_limit = 50 WHERE name = 'Enterprise';
