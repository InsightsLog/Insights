-- Migration: Add revision_history column to releases table
-- Description: Adds revision tracking for actual values (L2)
-- Date: 2026-01-11
-- Task: T230

-- Add revision_history column to releases table
-- Stores an array of revision records: [{previous_actual, new_actual, revised_at}]
ALTER TABLE releases 
ADD COLUMN IF NOT EXISTS revision_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN releases.revision_history IS 'Array of revision records: [{previous_actual, new_actual, revised_at}]';

-- Create index for querying releases with revisions
CREATE INDEX IF NOT EXISTS idx_releases_has_revisions 
ON releases ((jsonb_array_length(revision_history) > 0))
WHERE jsonb_array_length(revision_history) > 0;

-- Create trigger function to append to revision_history when actual is updated
-- This function is called BEFORE UPDATE on the releases table
CREATE OR REPLACE FUNCTION track_actual_revision()
RETURNS TRIGGER AS $$
BEGIN
    -- Only track revision if actual value changed (and both old and new are not null)
    -- Also skip if old actual is null (initial population is not a revision)
    IF OLD.actual IS NOT NULL AND NEW.actual IS DISTINCT FROM OLD.actual THEN
        NEW.revision_history = NEW.revision_history || jsonb_build_object(
            'previous_actual', OLD.actual,
            'new_actual', NEW.actual,
            'revised_at', NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on releases table
-- Drop first if exists to ensure idempotency
DROP TRIGGER IF EXISTS track_actual_revision_trigger ON releases;

CREATE TRIGGER track_actual_revision_trigger
    BEFORE UPDATE ON releases
    FOR EACH ROW
    EXECUTE FUNCTION track_actual_revision();

-- Add comment for documentation
COMMENT ON FUNCTION track_actual_revision() IS 'Trigger function that appends to revision_history when actual value is updated';
