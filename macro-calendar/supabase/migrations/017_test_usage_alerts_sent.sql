-- Test Migration: usage_alerts_sent table
-- Description: Test file to verify T325 migration
-- Task: T325

-- This file contains test queries to verify the usage_alerts_sent table was created correctly.

-- Test 1: Table exists with correct columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'usage_alerts_sent'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NO)
-- user_id (uuid, NO)
-- threshold (integer, NO)
-- billing_period_start (timestamp with time zone, NO)
-- sent_at (timestamp with time zone, NO)

-- Test 2: Unique constraint exists
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'usage_alerts_sent';

-- Test 3: Check constraint for threshold values
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'usage_alerts_sent'::regclass 
AND contype = 'c';

-- Test 4: RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'usage_alerts_sent';

-- Test 5: Insert test data (using service role)
-- INSERT INTO usage_alerts_sent (user_id, threshold, billing_period_start)
-- VALUES ('test-user-id', 80, '2026-01-01 00:00:00+00');

-- Test 6: Unique constraint prevents duplicate alerts
-- Second insert with same user_id, threshold, billing_period_start should fail
