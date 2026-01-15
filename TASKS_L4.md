# Tasks — Macro Calendar L4

## Overview
L4 focuses on **sub-second data propagation** and global data acquisition. All historical data starts from **2014**.

### Key Goal: Sub-Second Updates
Once data hits our database → clients receive it in **< 500ms** via Supabase Realtime.

---

## Data Sources

| Source | Env Variable | Historical | Upcoming | API Key |
|--------|-------------|------------|----------|---------|
| **FRED** | `FRED_API_KEY` | ✅ | — | Required |
| **BLS** | `BLS_API_KEY` | ✅ | — | Optional |
| **ECB** | — | ✅ | — | No |
| **IMF** | — | ✅ | — | No |
| **World Bank** | — | ✅ | — | No |
| **FMP** | `FMP_API_KEY` | — | ✅ | Required |
| **Finnhub** | `FINNHUB_API_KEY` | — | ✅ | Required |
| **Trading Economics** | `TRADING_ECONOMICS_API_KEY` | — | ✅ | Required |

### Get Free API Keys
- FRED: https://fred.stlouisfed.org/docs/api/api_key.html
- BLS: https://data.bls.gov/registrationEngine/
- FMP: https://financialmodelingprep.com/register
- Finnhub: https://finnhub.io/register

---

## T400 — Sub-Second Real-Time Updates

**Goal:** Database changes → Client in < 500ms

### Architecture
```
Data Sources → Supabase DB → Supabase Realtime → WebSocket → Client
                    ↓
              (< 100ms)      (< 100ms)        (< 100ms)
```

### Tasks
- [x] T400.1 Enable Supabase Realtime on `releases` and `indicators` tables
- [x] T400.2 Create `useRealtimeReleases` React hook for live updates
- [x] T400.3 Add real-time indicator to calendar page (live badge)
- [ ] T400.4 Add SSE fallback for browsers blocking WebSocket

### Implementation
```typescript
// Client-side real-time subscription
const supabase = createClient();
supabase
  .channel('releases')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'releases' },
    (payload) => updateUI(payload.new)
  )
  .subscribe();
```

---

## T401 — Historical Data Import

All scripts in `src/lib/data-import/`. All use 2014 start date.

### Completed ✅
- [x] FRED import (`fred-import.ts`)
- [x] BLS import (`bls-import.ts`)
- [x] ECB import (`ecb-import.ts`)
- [x] World Bank import (`world-bank-import.ts`)
- [x] IMF import (`imf-import.ts`)
- [x] Data validation (`validation.ts`)
- [x] Admin UI buttons

### Run All Imports
```bash
npx tsx src/lib/data-import/fred-import.ts
npx tsx src/lib/data-import/bls-import.ts
npx tsx src/lib/data-import/ecb-import.ts
npx tsx src/lib/data-import/world-bank-import.ts
npx tsx src/lib/data-import/imf-import.ts
```

---

## T402 — Upcoming Events Import

### Completed ✅
- [x] FMP client (`fmp-calendar-client.ts`)
- [x] Finnhub client (`finnhub-calendar-client.ts`)
- [x] Trading Economics client (`trading-economics-client.ts`)
- [x] Unified import with deduplication (`upcoming-import.ts`)

### Run Import
```bash
npx tsx src/lib/data-import/upcoming-import.ts
```

---

## T403 — Scheduled Sync (Cron)

### Tasks
- [x] T403.1 Create `/api/cron/sync-data` endpoint
- [x] T403.2 Configure `vercel.json` cron
- [x] T403.3 Document production setup in DEPLOY.md (Section 15)

### Cron Config
```json
{
  "crons": [
    { "path": "/api/cron/sync-data", "schedule": "0 23 * * *" }
  ]
}
```
Runs daily at 5:00 PM Central Time (23:00 UTC). Admins can also trigger syncs manually from the admin panel.

---

## T404 — Extended Calendar (30+ Days)

### Tasks
- [x] T404.1 Change default from 7 to 30 days
- [x] T404.2 Add date range selector
- [ ] T404.3 Add quick filters (Today, Week, Month)

---

## Backlog

- T410 — Mobile app (React Native)
- T411 — Outlook calendar sync
- T420 — Historical API for backtesting
- T421 — Charts and analytics
- T422 — Custom alert conditions

---

## Acceptance Criteria

### Sub-Second Updates ✅
- [x] Supabase Realtime enabled on releases table
- [x] Client receives updates in < 500ms
- [x] Live indicator shows real-time status

### Data Sources ✅
- [x] 5+ historical sources (FRED, BLS, ECB, IMF, World Bank)
- [x] 3+ upcoming sources (FMP, Finnhub, Trading Economics)
- [x] All data from 2014+

### Calendar ✅
- [x] Shows 30+ days by default
- [x] Date range selector
