# Manual Testing Guide for T407

## Prerequisites

1. **Supabase Project Setup**
   - Local Supabase instance running (`supabase start`)
   - Migrations applied (`supabase db reset`)
   - Service role key available

2. **API Keys**
   - FRED API key from https://fred.stlouisfed.org/docs/api/api_key.html
   - BLS API key (optional) from https://www.bls.gov/developers/api_signature_v2.htm

## Test Data Setup

### 1. Create Test Indicator

```sql
-- Insert a test indicator with FRED mapping
INSERT INTO indicators (id, name, country_code, category, source_name, series_id, data_source_name)
VALUES (
  gen_random_uuid(),
  'Consumer Price Index',
  'US',
  'Inflation',
  'Bureau of Labor Statistics',
  'CPIAUCSL',  -- FRED series ID for CPI
  'FRED'
);

-- Get the indicator ID
SELECT id, name, series_id, data_source_name FROM indicators WHERE name = 'Consumer Price Index';
```

### 2. Create Test Release

```sql
-- Insert a test release for the indicator
INSERT INTO releases (id, indicator_id, release_at, period, forecast, previous)
VALUES (
  gen_random_uuid(),
  '<indicator_id_from_above>',
  NOW() + INTERVAL '1 hour',  -- Future release time
  '2024-01',
  '306.5',
  '305.9'
);

-- Get the release ID
SELECT id, indicator_id, period, actual FROM releases WHERE indicator_id = '<indicator_id>';
```

### 3. Verify Data Sources Table

```sql
SELECT * FROM data_sources WHERE name = 'FRED';
```

## Test Cases

### Test Case 1: Successful FRED Import

**Setup:**
```bash
export FRED_API_KEY=your_actual_api_key
supabase functions serve import-release-data
```

**Request:**
```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/import-release-data' \
  --header 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "indicator_id": "<your_indicator_id>",
    "release_id": "<your_release_id>"
  }'
```

**Expected Result:**
- HTTP 200 OK
- Response contains `actual_value` with latest CPI value
- Database updated: `SELECT actual FROM releases WHERE id = '<release_id>';`
- Sync log created: `SELECT * FROM sync_logs ORDER BY started_at DESC LIMIT 1;`
- Webhook delivery logged: `SELECT * FROM webhook_deliveries ORDER BY created_at DESC LIMIT 1;`

### Test Case 2: Missing Data Source Mapping

**Setup:**
```sql
-- Create indicator without data source mapping
INSERT INTO indicators (id, name, country_code, category, source_name)
VALUES (
  gen_random_uuid(),
  'Test Indicator No Mapping',
  'US',
  'Test',
  'Manual'
);
```

**Expected Result:**
- HTTP 400 Bad Request
- Error message: "Indicator has no data source mapping configured"

### Test Case 3: Invalid API Key

**Setup:**
```bash
export FRED_API_KEY=invalid_key
```

**Expected Result:**
- HTTP 500 Internal Server Error
- Error message contains "FRED API error"
- Sync log with status = 'failed'

### Test Case 4: BLS Import

**Setup:**
```sql
-- Update indicator to use BLS
UPDATE indicators 
SET series_id = 'CES0000000001',  -- Nonfarm Payrolls
    data_source_name = 'BLS'
WHERE id = '<indicator_id>';

-- Update data source config
UPDATE data_sources
SET auth_config = '{"api_key_env": "BLS_API_KEY"}'
WHERE name = 'BLS';
```

**Request:** Same as Test Case 1

**Expected Result:**
- HTTP 200 OK
- Latest employment data fetched from BLS
- Database updated with actual value

### Test Case 5: Webhook Trigger Verification

**Setup:**
```sql
-- Create a test webhook endpoint
INSERT INTO webhook_endpoints (user_id, url, secret, events, enabled)
VALUES (
  (SELECT id FROM profiles LIMIT 1),
  'https://webhook.site/unique-url',
  'test_secret',
  ARRAY['release.published'],
  true
);
```

**Verification:**
1. Run Test Case 1
2. Check webhook.site for received payload
3. Verify payload contains indicator and release data
4. Verify X-Webhook-Signature header is present

### Test Case 6: Email Alert Trigger

**Setup:**
```sql
-- Enable email alerts for test user
INSERT INTO alert_preferences (user_id, indicator_id, email_enabled)
VALUES (
  (SELECT id FROM profiles LIMIT 1),
  '<indicator_id>',
  true
);
```

**Verification:**
1. Run Test Case 1
2. Check Resend dashboard (if configured) for sent email
3. Verify email contains release details

## Verification Queries

```sql
-- Check if release was updated
SELECT id, indicator_id, period, actual, forecast, previous
FROM releases
WHERE id = '<release_id>';

-- Check sync logs
SELECT data_source_id, status, records_processed, error_message, started_at, completed_at
FROM sync_logs
ORDER BY started_at DESC
LIMIT 5;

-- Check webhook deliveries
SELECT webhook_id, event_type, response_code, created_at
FROM webhook_deliveries
ORDER BY created_at DESC
LIMIT 5;

-- Check data source last sync time
SELECT name, last_sync_at
FROM data_sources;
```

## Cleanup

```sql
-- Remove test data
DELETE FROM releases WHERE indicator_id = '<test_indicator_id>';
DELETE FROM indicators WHERE id = '<test_indicator_id>';
DELETE FROM sync_logs WHERE data_source_id = (SELECT id FROM data_sources WHERE name = 'FRED');
```

## Common Issues

### Issue: "FRED API error: 400"
**Solution:** Check if series_id is valid. Visit https://fred.stlouisfed.org/series/<series_id> to verify.

### Issue: "Data source FRED not found or disabled"
**Solution:** Run the test migration: `supabase db reset` or manually insert FRED data source.

### Issue: Webhook not triggered
**Solution:** Check that webhook_endpoints table has enabled webhooks and that send-webhook function is deployed.

### Issue: Email not sent
**Solution:** Verify RESEND_API_KEY is configured and send-release-alert function is deployed.
