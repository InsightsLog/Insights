# Tasks — Macro Calendar L4

## Overview
L4 focuses on global data acquisition (free sources) and platform expansion.

---

## Priority 1: Free Global Data Acquisition

### T400 — Plan for Complete Live Global Data (Free)

#### Objective
Create a comprehensive strategy for acquiring real-time global economic data from free sources.

#### Free Data Sources

##### 1. Central Bank APIs & Data Portals

| Source | Coverage | Data Type | Format | Notes |
|--------|----------|-----------|--------|-------|
| **Federal Reserve (FRED API)** | US | 800,000+ time series | JSON/XML | Free API key required. Includes GDP, CPI, employment, interest rates |
| **European Central Bank (ECB SDW)** | EU/Eurozone | Monetary, banking, economic | SDMX/CSV | Free access, no key required |
| **Bank of England** | UK | Interest rates, monetary aggregates | XML/JSON | Free, rate limited |
| **Bank of Japan** | Japan | Monetary policy, economic indicators | CSV | Free download |
| **Reserve Bank of Australia** | Australia | Interest rates, exchange rates | CSV/RSS | Free access |
| **Bank of Canada** | Canada | Key indicators, exchange rates | JSON/CSV | Free API |
| **Swiss National Bank** | Switzerland | Interest rates, FX reserves | CSV | Free download |

##### 2. Government Statistics Offices

| Source | Coverage | Data Type | Format | Notes |
|--------|----------|-----------|--------|-------|
| **US Bureau of Labor Statistics (BLS)** | US | Employment, CPI, PPI | JSON | Free API, signature required for higher limits |
| **US Census Bureau** | US | Trade, manufacturing | JSON | Free API key |
| **Eurostat** | EU | All economic indicators | SDMX/JSON | Free, comprehensive |
| **UK Office for National Statistics** | UK | GDP, inflation, employment | JSON | Free API |
| **Statistics Canada** | Canada | All economic indicators | JSON/CSV | Free API |
| **Australian Bureau of Statistics** | Australia | CPI, employment, GDP | SDMX/CSV | Free access |
| **Japan Statistics Bureau** | Japan | All major indicators | CSV | Free download |

##### 3. International Organizations

| Source | Coverage | Data Type | Format | Notes |
|--------|----------|-----------|--------|-------|
| **World Bank Open Data** | 217 countries | Development indicators | JSON/XML | Free, no limits |
| **IMF Data API** | Global | GDP, trade, financial | SDMX/JSON | Free access |
| **OECD.Stat** | 38 member countries | Economic, social | SDMX/JSON | Free access |
| **UN Data** | Global | Wide range | XML/CSV | Free access |
| **BIS Statistics** | Global | Banking, financial | CSV | Free download |

##### 4. Market Data (Limited Free Access)

| Source | Coverage | Data Type | Format | Notes |
|--------|----------|-----------|--------|-------|
| **Alpha Vantage** | Global | Forex, commodities | JSON | Free tier: 25 calls/day |
| **Quandl (NASDAQ)** | Global | Some free datasets | JSON/CSV | Limited free datasets |
| **Yahoo Finance** | Global | Market data | JSON | Unofficial API, rate limited |

#### Implementation Strategy

##### Phase 1: Core Data Sources (Week 1-2)
1. **FRED API Integration**
   - Register for API key
   - Implement data fetcher for key US indicators
   - Target: GDP, CPI, PPI, Unemployment, Non-Farm Payrolls, Fed Funds Rate
   - Schedule: Daily sync at 8:30 AM ET (release time for most US data)

2. **BLS API Integration**
   - Register for API key (v2 with higher limits)
   - Implement data fetcher for employment and price data
   - Schedule: Monthly sync for employment data, monthly for CPI

3. **ECB Data Integration**
   - Implement SDMX parser
   - Target: ECB interest rates, Eurozone CPI, GDP
   - Schedule: Daily sync

##### Phase 2: Expanded Coverage (Week 3-4)
4. **UK Data (ONS API)**
   - GDP, CPI, Employment
   - Schedule: Weekly sync

5. **Japan Data (Bank of Japan, Statistics Bureau)**
   - Interest rates, CPI, GDP
   - Schedule: Daily for interest rates, monthly for CPI/GDP

6. **Canada, Australia, Switzerland**
   - Key central bank data
   - Schedule: As released

##### Phase 3: International Organizations (Week 5-6)
7. **World Bank / IMF Integration**
   - GDP, trade balances, current account for all countries
   - Schedule: Quarterly sync (data updated quarterly)

8. **OECD Data Integration**
   - Comprehensive OECD member country data
   - Schedule: Monthly sync

#### Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Pipeline                            │
├─────────────────────────────────────────────────────────────┤
│  1. Scheduler (Supabase Edge Function / Vercel Cron)        │
│     - Triggers data fetch at appropriate times               │
│     - Handles timezone-aware scheduling                      │
├─────────────────────────────────────────────────────────────┤
│  2. Data Fetchers (per source)                              │
│     - FRED Fetcher, BLS Fetcher, ECB Fetcher, etc.          │
│     - Handles authentication, rate limiting, retries        │
│     - Normalizes data to common format                       │
├─────────────────────────────────────────────────────────────┤
│  3. Data Processor                                          │
│     - Validates incoming data                                │
│     - Detects revisions (compares to existing values)       │
│     - Triggers webhooks/alerts for new releases             │
├─────────────────────────────────────────────────────────────┤
│  4. Database (Supabase/PostgreSQL)                          │
│     - Indicators table (existing)                            │
│     - Releases table (existing)                              │
│     - Data source metadata                                   │
└─────────────────────────────────────────────────────────────┘
```

#### Database Schema Additions

```sql
-- New table: data_sources
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,           -- e.g., 'FRED', 'BLS', 'ECB'
  api_url TEXT NOT NULL,
  api_key_env TEXT,            -- Environment variable name for API key
  rate_limit_requests INT,      -- Requests per minute
  rate_limit_window INT,        -- Window in seconds
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle', -- 'idle', 'running', 'error'
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link indicators to their data source (nullable columns for existing data compatibility)
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS data_source_id UUID REFERENCES data_sources(id);
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS external_series_id TEXT; -- e.g., FRED series ID
```

**Note:** The ALTER TABLE statements use `IF NOT EXISTS` and nullable columns to ensure compatibility with existing data. These columns are optional - indicators without a data source will continue to work.

#### Acceptance Criteria
- [ ] FRED API integration delivers 10+ US economic indicators
- [ ] ECB data integration delivers Eurozone rates and indicators
- [ ] BLS integration delivers employment and price data
- [ ] Automated daily/weekly sync runs without errors
- [ ] New releases trigger existing webhook/email alert infrastructure
- [ ] Revision detection works for updated values

---

### T401 — Plan for Complete Historical Global Data (Free)

#### Objective
Create a comprehensive strategy for acquiring 10+ years of historical economic data from free sources.

#### Historical Data Availability by Source

##### FRED (Federal Reserve Economic Data)
- **Coverage:** 800,000+ time series, many with 50+ years of history
- **Key Series for Initial Import:**
  - GDP (GDPC1) - quarterly since 1947
  - CPI (CPIAUCSL) - monthly since 1947
  - Unemployment Rate (UNRATE) - monthly since 1948
  - Non-Farm Payrolls (PAYEMS) - monthly since 1939
  - Federal Funds Rate (FEDFUNDS) - monthly since 1954
  - 10-Year Treasury (DGS10) - daily since 1962
  - Consumer Sentiment (UMCSENT) - monthly since 1952
  - Housing Starts (HOUST) - monthly since 1959
  - Industrial Production (INDPRO) - monthly since 1919
  - Retail Sales (RSXFS) - monthly since 1992

##### ECB Statistical Data Warehouse
- **Coverage:** Eurozone data since 1999 (Euro introduction)
- **Key Series:**
  - ECB Main Refinancing Rate - since 1999
  - Eurozone HICP (inflation) - since 1996
  - Eurozone GDP - since 1995
  - Eurozone Unemployment - since 1998

##### BLS (Bureau of Labor Statistics)
- **Coverage:** Deep US employment and price history
- **Key Series:**
  - CPI-U (all urban consumers) - monthly since 1913
  - PPI (Producer Price Index) - monthly since 1913
  - Employment by sector - monthly since 1939

##### World Bank
- **Coverage:** 217 countries, annual data for many indicators
- **Key Series:**
  - GDP (current USD, constant USD) - annual since 1960
  - Inflation, consumer prices - annual since 1960
  - Trade balance - annual since 1960
  - Current account balance - annual since 1970

##### IMF Data
- **Coverage:** Global macroeconomic data
- **Key Series:**
  - World Economic Outlook database - historical forecasts and actuals
  - International Financial Statistics - balance of payments, exchange rates

#### Bulk Import Strategy

##### Phase 1: US Historical Data (Week 1)
1. **FRED Bulk Download**
   - Use FRED bulk download feature for all target series
   - Parse CSV/JSON files
   - Import into releases table with proper timestamps
   - Estimated: 50,000+ historical data points

2. **BLS Historical Import**
   - Download historical series via API or bulk files
   - Focus on CPI, PPI, employment data
   - Estimated: 30,000+ historical data points

##### Phase 2: European Historical Data (Week 2)
3. **ECB SDW Bulk Download**
   - Download all Eurozone key indicators
   - Parse SDMX format
   - Import with proper period mapping
   - Estimated: 10,000+ historical data points

4. **UK ONS Historical Data**
   - Download GDP, CPI, employment history
   - Estimated: 5,000+ historical data points

##### Phase 3: Global Historical Data (Week 3-4)
5. **World Bank Bulk Import**
   - Use World Bank API to fetch all countries
   - Focus on: GDP, inflation, trade, employment for top 50 economies
   - Estimated: 100,000+ historical data points

6. **IMF Data Import**
   - World Economic Outlook historical data
   - Balance of payments data
   - Estimated: 50,000+ historical data points

#### Data Quality Considerations

1. **Deduplication**
   - Prevent duplicate imports
   - Use (indicator_id, release_at, period) as unique key

2. **Data Validation**
   - Validate numeric ranges
   - Check for outliers (>3 standard deviations)
   - Flag suspicious values for manual review

3. **Revision Handling**
   - Historical revisions should update existing records
   - Track revision history for major indicators

4. **Period Normalization**
   - Standardize period formats (Q1 2024, Jan 2024, 2024, etc.)
   - Handle different calendar systems (fiscal years)

#### Storage Estimates

| Source | Est. Records | Est. Raw Data | Est. with Indexes |
|--------|-------------|---------------|-------------------|
| FRED | 50,000 | 5 MB | 15 MB |
| BLS | 30,000 | 3 MB | 9 MB |
| ECB | 10,000 | 1 MB | 3 MB |
| World Bank | 100,000 | 10 MB | 30 MB |
| IMF | 50,000 | 5 MB | 15 MB |
| **Total** | **240,000** | **~25 MB** | **~75 MB** |

**Notes:**
- Estimates assume ~100 bytes per raw record, but PostgreSQL overhead (TOAST, MVCC, page alignment) typically adds 2-3x
- Index storage (on indicator_id, release_at, period) adds approximately 2x the raw data size
- Supabase free tier allows 500 MB database storage, so even with overhead this is well within limits
- Actual storage can be monitored via Supabase dashboard after initial import

#### Implementation Tasks

- [x] T401.1 Create bulk import script for FRED historical data
- [x] T401.2 Create bulk import script for BLS historical data
- [x] T401.3 Create bulk import script for ECB historical data
- [x] T401.4 Create bulk import script for World Bank data
- [x] T401.5 Create bulk import script for IMF data
- [x] T401.6 Add data validation and deduplication logic
- [x] T401.7 Create admin UI for triggering bulk imports
- [ ] T401.8 Document all imported series with source attribution

---

### T402 — Real-Time/Fast Data Updates Strategy

#### Objective
Implement a strategy for receiving economic data releases as fast as possible after they are published by government agencies and central banks.

#### Priority Data Sources by Speed

##### Tier 1: Near Real-Time (Minutes after release)
These sources update within minutes of official release:

| Source | Data Type | Update Speed | Method |
|--------|-----------|--------------|--------|
| **FRED** | US indicators | ~5-15 min | Scheduled polling at known release times |
| **ECB SDW** | Eurozone | ~30 min | Scheduled polling |
| **BLS** | US Employment/CPI | ~15 min | Scheduled polling at 8:30 AM ET |

##### Tier 2: Same-Day (Hours after release)
| Source | Data Type | Update Speed | Method |
|--------|-----------|--------------|--------|
| World Bank | Global indicators | Same day | Daily batch sync |
| IMF | Global indicators | Same day | Daily batch sync |
| OECD | OECD countries | Same day | Daily batch sync |

#### Implementation Plan

##### Phase 1: Scheduled Polling (Immediate Priority)
1. **Release Time Database**
   - Create a `release_schedules` table with known release times
   - US data: 8:30 AM ET (employment, CPI, GDP)
   - ECB data: 10:00 AM CET (interest rate decisions, HICP)
   - Example: "Non-Farm Payrolls releases first Friday of every month at 8:30 AM ET"

2. **Vercel Cron Jobs**
   - Set up cron jobs in `vercel.json` to poll at known release times
   - Polling frequency: Every 5 minutes during release windows
   - Off-peak: Every 30 minutes

3. **Release Detection**
   - Compare fetched data with existing releases
   - Trigger webhooks/email alerts for new data
   - Update revision history for changed values

##### Phase 2: Supabase Edge Functions (Week 2)
4. **Scheduled Edge Functions**
   - Deploy Edge Functions with scheduled invocations
   - More reliable than Vercel Cron for time-sensitive operations
   - Example: `supabase functions deploy fetch-fred-data --schedule "*/5 8-10 * * 1-5"`

5. **Multi-Source Aggregation**
   - Fetch from multiple sources simultaneously
   - Priority: FRED > BLS > ECB > World Bank
   - First valid data wins for each indicator

##### Phase 3: Push Notifications (Week 3-4)
6. **Webhook to Email/Push Pipeline**
   - When new release detected, trigger existing `send-release-alert` function
   - Send push notifications via webhook endpoints
   - Target latency: < 5 minutes from official release

#### Known Release Schedules

| Indicator | Source | Release Schedule | Time (Local) |
|-----------|--------|------------------|--------------|
| Non-Farm Payrolls | BLS | 1st Friday of month | 8:30 AM ET |
| Unemployment Rate | BLS | 1st Friday of month | 8:30 AM ET |
| CPI | BLS | ~12th of month | 8:30 AM ET |
| PPI | BLS | ~15th of month | 8:30 AM ET |
| Real GDP | BEA | End of month (Q+1) | 8:30 AM ET |
| Fed Funds Rate | FRED | After FOMC meetings | 2:00 PM ET |
| ECB Interest Rates | ECB | ECB meeting days | 2:15 PM CET |
| Eurozone HICP | Eurostat | End of month | 11:00 AM CET |

#### Vercel Cron Configuration

**Note:** Vercel Cron schedules use UTC timezone.

```jsonc
{
  "crons": [
    {
      "path": "/api/cron/fetch-releases",
      "schedule": "*/5 12-15 * * 1-5"
    },
    {
      "path": "/api/cron/fetch-releases",
      "schedule": "30 13 * * 1-5"
    }
  ]
}
```

**Schedule Explanation (UTC):**
- `*/5 12-15 * * 1-5`: Every 5 minutes from 12:00-15:59 UTC (covers 8:00 AM - 11:59 AM ET during EST)
- `30 13 * * 1-5`: 1:30 PM UTC = 8:30 AM ET (exact US release time during EST)
- During EDT (Daylight Saving): adjust to `30 12` for 8:30 AM ET

**DST Handling Note:** For production, consider using a timezone-aware scheduling solution (e.g., storing schedules in local timezone and converting at runtime) to automatically handle daylight saving transitions.

#### Implementation Tasks
- [ ] T402.1 Create `release_schedules` table with known release times
- [ ] T402.2 Implement `/api/cron/fetch-releases` endpoint
- [ ] T402.3 Set up Vercel Cron jobs for US release times (8:30 AM ET)
- [ ] T402.4 Set up Vercel Cron jobs for EU release times (10:00 AM CET)
- [ ] T402.5 Implement release detection and comparison logic
- [ ] T402.6 Trigger existing webhook/email infrastructure for new releases
- [ ] T402.7 Add release schedule management in admin dashboard
- [ ] T402.8 Document known release schedules by country

#### Acceptance Criteria
- [ ] US economic releases detected within 15 minutes of publication
- [ ] Eurozone releases detected within 30 minutes of publication
- [ ] Automatic webhook/email alerts triggered for new releases
- [ ] Revision detection works for updated values
- [ ] Admin can view and manage release schedules

---

## Priority 2: Mobile & Integrations

### T410 — Mobile App (React Native)
- [ ] T410.1 Set up React Native project with Expo
- [ ] T410.2 Implement authentication flow (magic link)
- [ ] T410.3 Create calendar view screen
- [ ] T410.4 Create watchlist screen
- [ ] T410.5 Implement push notifications for alerts
- [ ] T410.6 Add settings and account management
- [ ] T410.7 Submit to App Store and Play Store

### T411 — Outlook Calendar Integration
- [ ] T411.1 Research Outlook/Microsoft Graph API
- [ ] T411.2 Implement OAuth2 flow for Microsoft accounts
- [ ] T411.3 Create calendar event sync for watchlist items
- [ ] T411.4 Add UI for connecting Outlook account

### T412 — Slack/Discord Integrations
- [ ] T412.1 Create Slack app with OAuth2
- [ ] T412.2 Implement Slack webhook delivery
- [ ] T412.3 Create Discord app
- [ ] T412.4 Implement Discord webhook delivery (enhanced from current)
- [ ] T412.5 Add integration settings UI

---

## Priority 3: Advanced Features

### T420 — Historical Data API for Backtesting
- [ ] T420.1 Design API endpoints for historical data queries
- [ ] T420.2 Implement date range queries with pagination
- [ ] T420.3 Add data export in backtesting-friendly formats
- [ ] T420.4 Create documentation for quant users

### T421 — Advanced Analytics and Charting
- [ ] T421.1 Add chart component library (e.g., Recharts, D3)
- [ ] T421.2 Create indicator detail page charts
- [ ] T421.3 Add comparison charts (multiple indicators)
- [ ] T421.4 Implement forecast vs actual visualization

### T422 — Custom Alert Conditions
- [ ] T422.1 Design alert condition schema (e.g., "CPI > 3%")
- [ ] T422.2 Implement condition evaluation engine
- [ ] T422.3 Create UI for defining custom conditions
- [ ] T422.4 Integrate with existing alert infrastructure

### T423 — Embeddable Widgets
- [ ] T423.1 Design embed widget component
- [ ] T423.2 Create embed code generator
- [ ] T423.3 Implement iframe-based embedding
- [ ] T423.4 Add widget customization options

---

## Acceptance Criteria Summary

### Priority 1: Data Acquisition
- Live data from at least 5 major central banks/sources
- Historical data covering 10+ years for major indicators
- Automated daily/weekly sync without manual intervention
- Data quality validation and deduplication

### Priority 2: Mobile & Integrations
- Mobile app available on iOS and Android
- Outlook calendar sync working
- Slack/Discord integrations functional

### Priority 3: Advanced Features
- Historical API with proper pagination
- Interactive charts on indicator pages
- Custom alert conditions working
- Embeddable widgets functional

---

## Resources

### API Documentation Links
- FRED API: https://fred.stlouisfed.org/docs/api/fred/
- BLS API: https://www.bls.gov/developers/
- ECB SDW: https://sdw.ecb.europa.eu/
- World Bank: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392
- IMF Data: https://datahelp.imf.org/knowledgebase/articles/667681
- OECD: https://data.oecd.org/api/

### Free Tier Limits
| Source | Free Limit | Notes |
|--------|------------|-------|
| FRED | 120 requests/minute | Very generous |
| BLS | 25 requests/day (unsigned), 500/day (signed) | Register for higher limits |
| ECB | No stated limit | Fair use policy |
| World Bank | No stated limit | Very generous |
| IMF | No stated limit | Fair use policy |
