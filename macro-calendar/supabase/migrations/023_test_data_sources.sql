-- Test migration: 023_test_data_sources
-- Task: T407
-- Description: Seed test data for data_sources and sync_logs tables

-- Insert test data sources
INSERT INTO data_sources (name, type, base_url, auth_config, enabled) VALUES
  ('FRED', 'api', 'https://api.stlouisfed.org/fred', '{"api_key_env": "FRED_API_KEY"}', true),
  ('BLS', 'api', 'https://api.bls.gov/publicAPI/v2', '{"api_key_env": "BLS_API_KEY"}', true),
  ('ECB', 'api', 'https://data-api.ecb.europa.eu/service', '{}', true)
ON CONFLICT (name) DO NOTHING;

-- Add series_id and data_source_name to existing indicators for testing
-- Example: Map common US economic indicators to FRED series
UPDATE indicators SET 
  series_id = 'CPIAUCSL',
  data_source_name = 'FRED'
WHERE name LIKE '%Consumer Price Index%' 
  AND country_code = 'US' 
  AND series_id IS NULL;

UPDATE indicators SET 
  series_id = 'UNRATE',
  data_source_name = 'FRED'
WHERE name LIKE '%Unemployment Rate%' 
  AND country_code = 'US' 
  AND series_id IS NULL;

UPDATE indicators SET 
  series_id = 'GDPC1',
  data_source_name = 'FRED'
WHERE name LIKE '%GDP%' 
  AND country_code = 'US' 
  AND series_id IS NULL;

-- Insert a sample sync log
INSERT INTO sync_logs (data_source_id, status, records_processed, started_at, completed_at)
SELECT 
  id,
  'success',
  0,
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day' + INTERVAL '30 seconds'
FROM data_sources
WHERE name = 'FRED'
LIMIT 1;
