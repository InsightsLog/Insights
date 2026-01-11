-- Test: Verify revision_history column and trigger (T230)
-- Run this AFTER executing 010_add_revision_history.sql
-- Test steps documented for manual verification

-- =============================================================================
-- SETUP: Verify the column exists
-- =============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'releases' AND column_name = 'revision_history';

-- Expected:
-- revision_history, jsonb, NO, '[]'::jsonb

-- =============================================================================
-- VERIFY: Trigger function exists
-- =============================================================================

SELECT 
    routine_name,
    routine_type,
    data_type AS return_type
FROM information_schema.routines
WHERE routine_name = 'track_actual_revision' AND routine_schema = 'public';

-- Expected: track_actual_revision, FUNCTION, trigger

-- =============================================================================
-- VERIFY: Trigger exists on releases table
-- =============================================================================

SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_orientation
FROM information_schema.triggers
WHERE event_object_table = 'releases' 
AND trigger_name = 'track_actual_revision_trigger';

-- Expected: track_actual_revision_trigger, UPDATE, BEFORE, ROW

-- =============================================================================
-- VERIFY: Index exists for revision queries
-- =============================================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'releases' 
AND indexname = 'idx_releases_has_revisions';

-- Expected: idx_releases_has_revisions with partial index WHERE clause

-- =============================================================================
-- TEST: Revision history appended on actual update
-- =============================================================================

-- Step 1: Create test indicator (if not exists)
-- Note: Requires service role or bypass RLS for insert

-- Insert test indicator
-- INSERT INTO indicators (id, name, country_code, category, source_name)
-- VALUES ('11111111-1111-1111-1111-111111111111', 'Test CPI', 'US', 'Inflation', 'Test Source');

-- Step 2: Insert a release with an initial actual value
-- INSERT INTO releases (id, indicator_id, release_at, period, actual)
-- VALUES (
--     '22222222-2222-2222-2222-222222222222',
--     '11111111-1111-1111-1111-111111111111',
--     NOW(),
--     'Jan 2024',
--     '3.0%'
-- );

-- Step 3: Verify revision_history is empty initially
-- SELECT id, actual, revision_history FROM releases WHERE id = '22222222-2222-2222-2222-222222222222';
-- Expected: actual = '3.0%', revision_history = []

-- Step 4: Update the actual value (triggers revision tracking)
-- UPDATE releases SET actual = '3.2%' WHERE id = '22222222-2222-2222-2222-222222222222';

-- Step 5: Verify revision_history now has one entry
-- SELECT id, actual, revision_history FROM releases WHERE id = '22222222-2222-2222-2222-222222222222';
-- Expected: actual = '3.2%', revision_history = [{"new_actual": "3.2%", "revised_at": "...", "previous_actual": "3.0%"}]

-- Step 6: Update again to verify multiple revisions are tracked
-- UPDATE releases SET actual = '3.5%' WHERE id = '22222222-2222-2222-2222-222222222222';

-- Step 7: Verify revision_history now has two entries
-- SELECT id, actual, revision_history, jsonb_array_length(revision_history) as revision_count
-- FROM releases WHERE id = '22222222-2222-2222-2222-222222222222';
-- Expected: revision_count = 2, with both revisions in chronological order

-- =============================================================================
-- TEST: No revision tracked when actual set for first time (null to value)
-- =============================================================================

-- Step 1: Insert a release without actual value
-- INSERT INTO releases (id, indicator_id, release_at, period, actual)
-- VALUES (
--     '33333333-3333-3333-3333-333333333333',
--     '11111111-1111-1111-1111-111111111111',
--     NOW() + INTERVAL '1 day',
--     'Feb 2024',
--     NULL
-- );

-- Step 2: Set actual for the first time
-- UPDATE releases SET actual = '2.5%' WHERE id = '33333333-3333-3333-3333-333333333333';

-- Step 3: Verify revision_history is still empty (initial set is not a revision)
-- SELECT id, actual, revision_history FROM releases WHERE id = '33333333-3333-3333-3333-333333333333';
-- Expected: actual = '2.5%', revision_history = []

-- =============================================================================
-- TEST: No revision tracked when actual updated to same value
-- =============================================================================

-- Step 1: Update a release with the same actual value
-- UPDATE releases SET actual = '3.5%' WHERE id = '22222222-2222-2222-2222-222222222222';

-- Step 2: Verify revision_history is not changed (same value = no revision)
-- SELECT id, actual, revision_history, jsonb_array_length(revision_history) as revision_count
-- FROM releases WHERE id = '22222222-2222-2222-2222-222222222222';
-- Expected: revision_count still = 2 (no new entry added)

-- =============================================================================
-- TEST: Querying releases with revisions
-- =============================================================================

-- Find all releases that have been revised
-- SELECT r.id, i.name as indicator_name, r.actual, 
--        jsonb_array_length(r.revision_history) as revision_count
-- FROM releases r
-- JOIN indicators i ON r.indicator_id = i.id
-- WHERE jsonb_array_length(r.revision_history) > 0
-- ORDER BY r.release_at DESC;

-- =============================================================================
-- CLEANUP: Remove test data (optional)
-- =============================================================================

-- DELETE FROM releases WHERE id IN (
--     '22222222-2222-2222-2222-222222222222',
--     '33333333-3333-3333-3333-333333333333'
-- );
-- DELETE FROM indicators WHERE id = '11111111-1111-1111-1111-111111111111';
