# import-release-data Edge Function

## Overview
This Supabase Edge Function is responsible for fetching actual economic data values from external APIs (FRED, BLS, ECB) when releases occur, updating the database, and triggering notifications.

## Task
T407 - Add data import cron job

## Dependencies

### Database Tables
- `data_sources` - Configuration for external data sources
- `sync_logs` - Audit trail for sync operations
- `indicators` - Must have `series_id` and `data_source_name` columns
- `releases` - Target table for actual values

### Edge Functions
- `send-webhook` - Triggered after successful import
- `send-release-alert` - Triggered after successful import

### Environment Variables
Required for production:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `FRED_API_KEY` - API key for Federal Reserve Economic Data
- `BLS_API_KEY` - API key for Bureau of Labor Statistics (optional)

## API Specification

### Endpoint
`POST /functions/v1/import-release-data`

### Request Body
```json
{
  "indicator_id": "uuid",
  "release_id": "uuid"
}
```

### Response (Success)
```json
{
  "message": "Data import completed successfully",
  "indicator_id": "uuid",
  "release_id": "uuid",
  "actual_value": "123.45",
  "data_source": "FRED"
}
```

### Response (No Data Available)
```json
{
  "message": "No data available from source",
  "indicator_id": "uuid",
  "release_id": "uuid",
  "data_source": "FRED"
}
```

### Response (Error)
```json
{
  "error": "Failed to fetch data from source",
  "details": "FRED API error: 401"
}
```

## Testing Locally

### Prerequisites
1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Start Supabase locally:
   ```bash
   cd macro-calendar
   supabase start
   ```

3. Apply migrations:
   ```bash
   supabase db reset
   ```

4. Set environment variables:
   ```bash
   export FRED_API_KEY=your_api_key_here
   export BLS_API_KEY=your_api_key_here
   ```

### Serve the Function
```bash
cd macro-calendar
supabase functions serve import-release-data --env-file .env.local
```

### Test with curl
```bash
# First, create test data (indicator with series_id and data_source_name)
# Then create a release record

# Example request
curl -i --location --request POST 'http://localhost:54321/functions/v1/import-release-data' \
  --header 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "indicator_id": "uuid-of-indicator",
    "release_id": "uuid-of-release"
  }'
```

## Data Source Configuration

### FRED (Federal Reserve Economic Data)
- Base URL: `https://api.stlouisfed.org/fred`
- Requires: API key from https://fred.stlouisfed.org/docs/api/api_key.html
- Series ID format: `CPIAUCSL` (CPI), `UNRATE` (Unemployment), `GDPC1` (GDP)

### BLS (Bureau of Labor Statistics)
- Base URL: `https://api.bls.gov/publicAPI/v2`
- Optional: API key for higher rate limits
- Series ID format: `CES0000000001` (Nonfarm Payrolls)

### ECB (European Central Bank)
- Base URL: `https://data-api.ecb.europa.eu/service`
- No API key required
- Series format: `flowRef/seriesKey` (e.g., `EXR/D.USD.EUR.SP00.A`)

## Deployment

### Deploy to Supabase
```bash
cd macro-calendar
supabase functions deploy import-release-data
```

### Set Production Secrets
```bash
supabase secrets set FRED_API_KEY=your_prod_api_key
supabase secrets set BLS_API_KEY=your_prod_api_key
```

## Workflow

1. **Receive Request** - Function is called with `indicator_id` and `release_id`
2. **Fetch Indicator** - Look up indicator details including `series_id` and `data_source_name`
3. **Validate Mapping** - Ensure indicator has valid data source configuration
4. **Fetch Data Source Config** - Get API credentials from `data_sources` table
5. **Call External API** - Fetch latest value from FRED/BLS/ECB
6. **Update Release** - Set `actual` value in `releases` table
7. **Trigger Webhooks** - Call `send-webhook` function
8. **Trigger Alerts** - Call `send-release-alert` function
9. **Log Sync** - Record result in `sync_logs` table

## Error Handling

The function handles several error scenarios:
- Missing or invalid request parameters → 400 Bad Request
- Indicator not found → 404 Not Found
- Release not found → 404 Not Found
- Indicator has no data source mapping → 400 Bad Request
- Data source not configured or disabled → 500 Internal Server Error
- API call failure → 500 Internal Server Error
- Database update failure → 500 Internal Server Error

All errors are logged to `sync_logs` with appropriate status:
- `success` - Data fetched and release updated
- `partial` - Data fetched but not saved, or no data available
- `failed` - API call or configuration error

## Future Enhancements

- Add retry logic with exponential backoff for API failures
- Support batch imports for multiple releases
- Add caching to avoid duplicate API calls
- Implement rate limiting per data source
- Add support for additional data sources (Trading Economics, etc.)
- Automatic scheduling based on release times
