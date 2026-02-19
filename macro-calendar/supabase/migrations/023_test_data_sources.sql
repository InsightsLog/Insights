-- Test migration: data_sources and sync_logs tables
-- Verifies T400 table creation and constraints
-- Date: 2026-02-19

-- Test 1: Insert sample data sources
INSERT INTO data_sources (name, type, base_url, enabled)
VALUES
  ('ForexFactory', 'scraper', 'https://www.forexfactory.com/calendar', true),
  ('Investing.com', 'scraper', 'https://www.investing.com/economic-calendar/', true),
  ('FRED', 'api', 'https://api.stlouisfed.org/fred', true),
  ('BLS', 'api', 'https://api.bls.gov/publicAPI', true);

-- Test 2: Insert sync log for ForexFactory
INSERT INTO sync_logs (data_source_id, status, records_processed, started_at, completed_at)
SELECT id, 'success', 150, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '59 minutes'
FROM data_sources WHERE name = 'ForexFactory';

-- Test 3: Insert failed sync log with error message
INSERT INTO sync_logs (data_source_id, status, records_processed, error_message, started_at, completed_at)
SELECT id, 'failed', 0, 'Connection timeout', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'
FROM data_sources WHERE name = 'Investing.com';

-- Test 4: Verify data_sources constraints
DO $$
DECLARE
  test_count INTEGER;
BEGIN
  -- Check that all data sources were inserted
  SELECT COUNT(*) INTO test_count FROM data_sources;
  IF test_count != 4 THEN
    RAISE EXCEPTION 'Expected 4 data sources, got %', test_count;
  END IF;

  -- Check that all inserted sources have valid types
  SELECT COUNT(*) INTO test_count FROM data_sources WHERE type NOT IN ('scraper', 'api');
  IF test_count != 0 THEN
    RAISE EXCEPTION 'Found invalid data source type';
  END IF;

  -- Check unique name constraint
  BEGIN
    INSERT INTO data_sources (name, type, base_url) VALUES ('ForexFactory', 'scraper', 'test');
    RAISE EXCEPTION 'Expected unique constraint violation on name';
  EXCEPTION
    WHEN unique_violation THEN
      -- Expected behavior
      NULL;
  END;

  RAISE NOTICE 'data_sources table tests passed';
END $$;

-- Test 5: Verify sync_logs constraints and foreign key
DO $$
DECLARE
  test_count INTEGER;
  test_source_id UUID;
BEGIN
  -- Check that sync logs were inserted
  SELECT COUNT(*) INTO test_count FROM sync_logs;
  IF test_count != 2 THEN
    RAISE EXCEPTION 'Expected 2 sync logs, got %', test_count;
  END IF;

  -- Check that all sync logs have valid status
  SELECT COUNT(*) INTO test_count FROM sync_logs WHERE status NOT IN ('success', 'partial', 'failed');
  IF test_count != 0 THEN
    RAISE EXCEPTION 'Found invalid sync log status';
  END IF;

  -- Test foreign key constraint (should fail)
  BEGIN
    INSERT INTO sync_logs (data_source_id, status) VALUES (gen_random_uuid(), 'success');
    RAISE EXCEPTION 'Expected foreign key violation';
  EXCEPTION
    WHEN foreign_key_violation THEN
      -- Expected behavior
      NULL;
  END;

  -- Test cascade delete
  SELECT id INTO test_source_id FROM data_sources WHERE name = 'BLS';
  INSERT INTO sync_logs (data_source_id, status) VALUES (test_source_id, 'success');
  DELETE FROM data_sources WHERE id = test_source_id;
  
  SELECT COUNT(*) INTO test_count FROM sync_logs WHERE data_source_id = test_source_id;
  IF test_count != 0 THEN
    RAISE EXCEPTION 'Expected cascade delete to remove sync logs';
  END IF;

  RAISE NOTICE 'sync_logs table tests passed';
END $$;

-- Cleanup: Remove test data
DELETE FROM sync_logs;
DELETE FROM data_sources;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✓ All data_sources and sync_logs table tests passed';
END $$;
