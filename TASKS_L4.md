# Tasks — Macro Calendar L4

## Overview
L4 focuses on data acquisition, mobile experience, and advanced analytics.

---

## 0) Data Acquisition

- [x] T400 Add data_sources table
  - Migration: data_sources(id, name, type, base_url, auth_config, enabled, last_sync_at, created_at)
  - Types: 'scraper', 'api'
  - Store API credentials encrypted in auth_config (JSONB)
  - RLS: admin-only access via service role
  - Test: can create data source; credentials stored securely

- [ ] T401 Add ForexFactory scraper
  - Supabase Edge Function: scrape-forexfactory
  - Parse economic calendar HTML for release schedules
  - Extract: indicator name, country, date/time, importance
  - Handle timezone conversion to UTC
  - Test: scraper returns structured schedule data

- [ ] T402 Add Investing.com scraper as fallback
  - Supabase Edge Function: scrape-investing
  - Backup source when ForexFactory unavailable
  - Match indicator names to existing indicators
  - Test: scraper returns schedule data; fallback works

- [ ] T403 Add schedule sync cron job
  - Scheduled function: sync-release-schedules (daily)
  - Fetches upcoming release times from scrapers
  - Updates releases table with scheduled times
  - Logs sync results to sync_logs table
  - Test: cron job populates release_at for upcoming releases

- [x] T404 Add FRED API integration
  - Module: src/lib/data-sources/fred.ts
  - Fetch economic data from Federal Reserve Economic Data API
  - Map FRED series to indicators (e.g., CPIAUCSL → CPI)
  - Handle rate limiting and retries
  - Test: can fetch and parse FRED data

- [x] T405 Add BLS API integration
  - Module: src/lib/data-sources/bls.ts
  - Fetch employment data from Bureau of Labor Statistics API
  - Map BLS series to indicators (e.g., CES0000000001 → NFP)
  - Test: can fetch and parse BLS data

- [x] T406 Add ECB API integration
  - Module: src/lib/data-sources/ecb.ts
  - Fetch European economic data from ECB Statistical Data Warehouse
  - Map ECB series to indicators
  - Test: can fetch and parse ECB data

- [ ] T407 Add data import cron job
  - Scheduled function: import-release-data
  - Triggered at release times (from scraped schedules)
  - Fetches actual values from API sources
  - Updates releases table with actual values
  - Triggers webhooks and email alerts on update
  - Test: release data imported at scheduled times

- [ ] T408 Add data source admin UI
  - Route: /admin/data-sources
  - Create/edit/delete data source configurations
  - Manual sync button per source
  - View sync history and errors
  - Test: can manage data sources; sync logs displayed

---

## 1) Mobile App

- [ ] T410 Initialize React Native project
  - Create React Native app with Expo
  - Share types and API client with web app
  - Configure navigation (React Navigation)
  - Test: app runs on iOS and Android simulators

- [ ] T411 Add mobile authentication
  - Magic link auth with deep link handling
  - Secure token storage (expo-secure-store)
  - Auth state persistence
  - Test: can sign in/out on mobile

- [ ] T412 Add mobile calendar screen
  - Display upcoming releases (next 7 days)
  - Pull-to-refresh
  - Filter by country/category
  - Test: calendar displays releases; filters work

- [ ] T413 Add mobile watchlist screen
  - Display saved indicators
  - Add/remove from watchlist
  - Alert toggle per indicator
  - Test: can manage watchlist on mobile

- [ ] T414 Add mobile push notifications
  - Expo push notifications setup
  - User notification preferences
  - Triggered by release.published events
  - Test: push notification received on release

- [ ] T415 Add mobile indicator detail screen
  - Display indicator info and releases
  - Historical data chart
  - Add to watchlist button
  - Test: indicator detail displays correctly

---

## 2) Calendar Integrations

- [ ] T420 Add Google Calendar OAuth integration
  - OAuth 2.0 flow for Google Calendar API
  - Store refresh tokens securely
  - Route: /settings/integrations
  - Test: can authorize Google Calendar access

- [ ] T421 Add Google Calendar sync
  - Create calendar events for watchlist releases
  - Two-way sync: updates reflected in both directions
  - Configurable reminder times
  - Test: events appear in Google Calendar

- [ ] T422 Add Outlook Calendar OAuth integration
  - OAuth 2.0 flow for Microsoft Graph API
  - Store refresh tokens securely
  - Test: can authorize Outlook Calendar access

- [ ] T423 Add Outlook Calendar sync
  - Create calendar events for watchlist releases
  - Two-way sync with Outlook
  - Test: events appear in Outlook Calendar

- [ ] T424 Add calendar sync settings UI
  - Route: /settings/integrations
  - Connect/disconnect calendar accounts
  - Choose which watchlists to sync
  - Set default reminder times
  - Test: can manage calendar integrations

---

## 3) Historical Data API

- [x] T430 Add /api/v1/historical endpoint
  - GET /api/v1/historical/:indicator_id
  - Query params: from_date, to_date, limit, offset
  - Returns time series data with pagination
  - Requires API key with appropriate plan
  - Test: historical data returned; pagination works

- [x] T431 Add bulk historical data export
  - GET /api/v1/historical/bulk
  - Export multiple indicators in single request
  - Supports CSV and JSON formats
  - Rate limited based on plan
  - Test: bulk export works; rate limits enforced

- [x] T432 Add historical data documentation
  - Update /docs/api with historical endpoints
  - Add backtesting examples
  - Include sample code for common use cases
  - Test: documentation accurate and helpful

---

## 4) Advanced Analytics

- [ ] T440 Add indicator analytics dashboard
  - Route: /indicator/:id/analytics
  - Actual vs forecast comparison chart
  - Surprise metrics (actual - forecast)
  - Historical accuracy of forecasts
  - Test: analytics display correctly

- [ ] T441 Add correlation analysis
  - Show correlations between indicators
  - Cross-country comparisons
  - Lead/lag relationships
  - Test: correlations calculated correctly

- [ ] T442 Add release impact analysis
  - Track market reactions to releases
  - Historical surprise impact data
  - Volatility metrics around releases
  - Test: impact metrics displayed

- [ ] T443 Add custom alerts for analytics
  - Alert when surprise exceeds threshold
  - Alert on correlation changes
  - Alert on forecast accuracy anomalies
  - Test: analytics alerts trigger correctly

---

## Acceptance Criteria Summary

### Data Acquisition
- Release schedules scraped from ForexFactory with Investing.com fallback
- Actual values imported from FRED, BLS, ECB at scheduled times
- Data source management in admin dashboard
- Sync logs and error handling

### Mobile App
- Native iOS and Android app with React Native
- Authentication, calendar, watchlist, and push notifications
- Consistent experience with web app

### Calendar Integrations
- OAuth integration with Google and Outlook calendars
- Two-way sync for watchlist releases
- Configurable reminder settings

### Historical Data API
- Time series data for backtesting
- Bulk export with rate limiting
- Comprehensive documentation

### Advanced Analytics
- Actual vs forecast comparisons
- Correlation and impact analysis
- Custom alert conditions
