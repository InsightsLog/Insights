# Roadmap

**Current focus:** L2 — alerts, API, and enhanced security.

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

## L2 (In Progress)
- Email alerts for saved indicators (opt-in per indicator)
- Role-based admin access with audit logging (replace shared secret)
- Rate limiting and abuse protections for public and watchlist endpoints
- Revision tracking: show diffs when actual values are revised

## L3 (Planned)
- Webhook/push notifications for instant release alerts
- Full REST API with API keys
- Billing integration and usage quotas
- Multi-tenant admin dashboard
