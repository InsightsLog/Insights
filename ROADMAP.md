# Roadmap

**Current focus:** L4 — Global data acquisition and platform expansion.

## L0 (Shipped)
- Public calendar list + search/filter
- Indicator detail pages with historical table
- Admin CSV upload (shared-secret)

## L1 (Shipped)
- Supabase auth with magic-link sign-in
- Profiles table with RLS and auto-provisioning
- Watchlist table + server actions + `/watchlist` page
- Calendar filter: "My Watchlist"
- Performance + security polish for admin upload (batching, tests)

## L2 (Shipped)
- Email alerts for saved indicators (opt-in per indicator)
- Role-based admin access with audit logging (replace shared secret)
- Rate limiting and abuse protections for public and watchlist endpoints
- Revision tracking: show diffs when actual values are revised
- API key generation for authenticated users
- Request logging for abuse detection

## L3 (Shipped)
- Webhook/push notifications for instant release alerts
- Full REST API with versioning (/api/v1/)
- Billing integration with Stripe and usage quotas
- Multi-tenant admin dashboard with organizations
- Data export (CSV, JSON, iCal)
- Calendar integrations (iCal feed, Google Calendar one-click add)
- Mobile-responsive improvements and PWA support
- Settings navigation with dropdown menu for authenticated users

## L4 (In Progress)
### Priority 1: Free Global Data Acquisition
- **Live Data Strategy:** Plan and implement free sources for real-time global economic data
- **Historical Data Strategy:** Plan and implement free sources for comprehensive historical data

### Priority 2: Mobile & Integrations
- Mobile app (React Native)
- Calendar integrations (Outlook sync)
- Slack/Discord integrations

### Priority 3: Advanced Features
- Historical data API for backtesting
- Advanced analytics and charting
- Custom alert conditions (threshold-based alerts)
- Embeddable widgets for external sites
- Public API with OAuth2 authentication
