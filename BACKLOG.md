# Backlog — Future Improvements

Items discovered during development that are out of current scope.

## L3 (Shipped)
All L3 items have been completed. See TASKS_L3.md for detailed task definitions:
- ✓ Webhook/push notifications for instant release alerts
- ✓ Full REST API with API keys and versioning
- ✓ Billing integration (Stripe) and usage quotas
- ✓ Multi-tenant admin dashboard
- ✓ Data export (CSV, JSON, iCal)
- ✓ Calendar integrations (iCal feed, Google Calendar)
- ✓ Settings navigation dropdown in header

## L4 Priority Tasks (In Progress)

### Priority 1: Free Global Data Acquisition (Complete G20 Coverage)
These are the highest priority items for L4:

1. **Complete G20 Country Coverage** ✓
   - All G20 member countries are now covered by data import sources
   - World Bank: 38+ countries including all G20 members
   - IMF: 37+ countries including all G20 members
   - ECB: EU/Eurozone coverage
   - FRED/BLS: US-specific detailed data
   - See DEPLOY.md Section 14 for full coverage details

2. **Plan for Complete Live Global Data (Free)**
   - Research and document free sources for real-time economic data
   - Target sources: Central banks, government statistics offices, international organizations
   - Implementation strategy for automated data ingestion
   - See TASKS_L4.md T400 for detailed plan

3. **Plan for Complete Historical Global Data (Free)** (Mostly Complete)
   - Research and document free sources for historical economic data
   - Target: 10+ years of data for major indicators across all countries
   - Implementation strategy for bulk data import and updates
   - See TASKS_L4.md T401 for detailed plan

4. **Real-Time/Fast Data Updates** (NEW - High Priority)
   - Implement aggressive polling for known release times
   - US releases: 8:30 AM ET (employment, CPI, GDP)
   - EU releases: 2:15 PM CET (ECB decisions), 11:00 AM CET (HICP)
   - **Target latency: < 1 minute from official release**
   - Sub-minute polling using Supabase Edge Functions
   - Real-time client updates via SSE/WebSocket
   - See TASKS_L4.md T402 for detailed plan

### Priority 2: Calendar Sync
- **Calendar Integrations** ✓ (Partial)
  - ✓ iCal/ICS export for watchlist
  - ✓ Google Calendar one-click add
  - [ ] Outlook Calendar sync (see T411)
  - [ ] Automatic calendar subscription (live-updating iCal feed)

## L4+ Ideas
- Mobile app (React Native)
- Calendar integrations (Outlook sync)
- Historical data API for backtesting
- Advanced analytics and charting
- Custom alert conditions (threshold-based alerts)
- Slack/Discord integrations
- Embeddable widgets for external sites
- Public API with OAuth2 authentication
