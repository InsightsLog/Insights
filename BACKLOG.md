# Backlog — Future Improvements

Items discovered during development that are out of current scope.

## L3 (In Progress)
See TASKS_L3.md for detailed task definitions:
- Webhook/push notifications for instant release alerts
- Full REST API with API keys and versioning
- Billing integration (Stripe) and usage quotas
- Multi-tenant admin dashboard
- Data export (CSV, JSON, iCal)

## L4 Prerequisites (Before Starting L4 Development)
**Data Acquisition Strategy:**
1. **Release Schedule Scraping**:
   - Primary source: Scrape ForexFactory for economic release schedules
   - Backup source: Investing.com calendar as fallback
2. **Release Data Import**:
   - Pull release data from our API sources (FRED, BLS, ECB, etc.) at the times obtained from ForexFactory/Investing.com scraping

## L4+ Ideas
- Mobile app (React Native)
- Calendar integrations (Google Calendar, Outlook)
- Historical data API for backtesting
- Advanced analytics and charting
- Custom alert conditions (threshold-based alerts)
