# Roadmap

**Current focus:** L3 — API, webhooks, and monetization foundations.

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

## L3 (In Progress)
- Webhook/push notifications for instant release alerts
- Full REST API with versioning (/api/v1/)
- Billing integration with Stripe and usage quotas
- Multi-tenant admin dashboard with organizations
- Data export (CSV, JSON, iCal)

## L4 (Planned)
- Mobile app (React Native)
- Calendar integrations (Google Calendar, Outlook)
- Historical data API for backtesting
- Advanced analytics and charting
