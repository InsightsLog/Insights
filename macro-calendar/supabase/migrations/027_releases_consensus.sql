-- Migration 027: Add consensus column to releases table
-- Adds analyst consensus forecast value alongside existing forecast field.
-- revised column already exists from 001_create_tables.sql.

ALTER TABLE releases ADD COLUMN IF NOT EXISTS consensus TEXT;

COMMENT ON COLUMN releases.consensus IS 'Analyst consensus forecast for the release period';
