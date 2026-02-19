# Manual Testing Guide for T403

This document provides manual testing steps for the sync-release-schedules cron job.

## Prerequisites

1. Database migrations applied:
   - Run `023_create_data_sources.sql` in Supabase SQL Editor
   - Run `023_test_data_sources.sql` to verify tables are created correctly

2. Environment variables configured:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
   - `CRON_SECRET`: A random secret (e.g., generated with `openssl rand -hex 32`)

3. Local development server running:
   ```bash
   cd macro-calendar
   npm run dev
   ```

## Test 1: Verify Database Tables

1. Open Supabase SQL Editor
2. Run the following query:
   ```sql
   SELECT * FROM data_sources;
   SELECT * FROM sync_logs;
   ```
3. **Expected**: Tables exist and are empty (or contain test data if you ran the test migration)

## Test 2: Insert Test Data Source

1. In Supabase SQL Editor, run:
   ```sql
   INSERT INTO data_sources (name, type, base_url, enabled)
   VALUES ('Test Source', 'api', 'https://example.com', true);
   
   SELECT * FROM data_sources;
   ```
2. **Expected**: Data source is inserted successfully

## Test 3: Trigger Cron Job Without Auth (Should Fail)

1. Open terminal and run:
   ```bash
   curl -X POST http://localhost:3000/api/cron/sync-release-schedules \
     -H "Content-Type: application/json"
   ```
2. **Expected**: HTTP 401 Unauthorized with error message about missing CRON_SECRET

## Test 4: Trigger Cron Job With Valid Auth (Should Succeed)

1. Replace `YOUR_CRON_SECRET` with your actual `CRON_SECRET` value and run:
   ```bash
   curl -X POST http://localhost:3000/api/cron/sync-release-schedules \
     -H "Authorization: Bearer YOUR_CRON_SECRET" \
     -H "Content-Type: application/json"
   ```
2. **Expected**: HTTP 200 with JSON response containing:
   ```json
   {
     "status": "success",
     "duration_ms": <number>,
     "total_records_processed": 0,
     "sources_synced": 1,
     "results": [
       {
         "status": "success",
         "records_processed": 0,
         "error_message": "Test Source scraper not yet implemented"
       }
     ]
   }
   ```

## Test 5: Verify Sync Logs

1. In Supabase SQL Editor, run:
   ```sql
   SELECT 
     sl.*,
     ds.name as data_source_name
   FROM sync_logs sl
   JOIN data_sources ds ON ds.id = sl.data_source_id
   ORDER BY sl.started_at DESC;
   ```
2. **Expected**: At least one sync log entry with:
   - status: 'success'
   - records_processed: 0
   - error_message: 'Test Source scraper not yet implemented'
   - completed_at timestamp

## Test 6: Verify last_sync_at Updated

1. In Supabase SQL Editor, run:
   ```sql
   SELECT name, enabled, last_sync_at 
   FROM data_sources
   ORDER BY last_sync_at DESC;
   ```
2. **Expected**: The `last_sync_at` field should be updated to the recent timestamp

## Test 7: GET Request Should Fail

1. Run:
   ```bash
   curl -X GET http://localhost:3000/api/cron/sync-release-schedules
   ```
2. **Expected**: HTTP 405 Method Not Allowed with error message

## Test 8: Verify Cron Schedule Configuration

1. Open `/vercel.json` in the repository
2. **Expected**: Should contain:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/sync-release-schedules",
         "schedule": "0 2 * * *"
       }
     ]
   }
   ```
3. This means the cron job will run daily at 02:00 UTC when deployed to Vercel

## Cleanup

After testing, remove test data:
```sql
DELETE FROM sync_logs;
DELETE FROM data_sources WHERE name = 'Test Source';
```

## Notes

- The sync service currently returns a placeholder response because actual scrapers (T401, T402) and API integrations (T404-T406) are not yet implemented
- When scrapers are added in future tasks, they will be integrated into the `syncFromSource` function in `src/lib/sync/schedule-sync.ts`
- The scaffolding is complete and ready for future scraper implementations
