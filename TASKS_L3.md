# Tasks — Macro Calendar L3

## Overview
L3 focuses on API access, webhooks, and monetization foundations.

---

## 0) Webhook Notifications

- [x] T300 Add webhook_endpoints table
  - Migration: webhook_endpoints(id, user_id, url, secret, events, created_at, updated_at, last_triggered_at)
  - Events: array of event types ('release.published', 'release.revised')
  - RLS: users can only CRUD their own webhooks
  - Test: insert webhook endpoint; verify RLS blocks other users

- [x] T301 Add webhook server actions
  - File: src/app/actions/webhooks.ts
  - Actions: createWebhook, updateWebhook, deleteWebhook, listWebhooks, testWebhook
  - Webhook URL validation (HTTPS required, no localhost in production)
  - Test: actions modify webhook_endpoints table correctly

- [x] T302 Add webhook management UI
  - Route: /settings/webhooks
  - Component: WebhooksClient.tsx
  - Create/edit/delete webhook endpoints
  - Test endpoint with sample payload
  - Show delivery history (last 10 attempts) - deferred to T304 (requires webhook_deliveries table)
  - Test: can create/edit/delete webhooks; test button sends sample payload

- [x] T303 Add webhook delivery Edge Function
  - Supabase Edge Function: send-webhook
  - Triggered alongside email alerts when releases are published/revised
  - Signs payload with HMAC-SHA256 using endpoint secret
  - Retry logic with exponential backoff (3 attempts)
  - Test: publishing release triggers webhook to registered endpoints

- [x] T304 Add webhook_deliveries table for delivery tracking
  - Migration: webhook_deliveries(id, webhook_id, event_type, payload, response_code, response_body, attempted_at)
  - No RLS (admin-only access via service role)
  - Test: delivery attempts logged with status codes

---

## 1) Public REST API

- [x] T310 Design API schema and versioning strategy
  - Document API endpoints in OpenAPI/Swagger format
  - Version prefix: /api/v1/
  - Rate limits per API key tier
  - Test: OpenAPI spec validates correctly

- [x] T311 Add /api/v1/indicators endpoint
  - GET /api/v1/indicators - List all indicators with pagination
  - GET /api/v1/indicators/:id - Get single indicator with latest releases
  - Query params: country, category, search, limit, offset
  - Requires valid API key in Authorization header
  - Test: API returns correct data; invalid key returns 401

- [x] T312 Add /api/v1/releases endpoint
  - GET /api/v1/releases - List releases with pagination
  - GET /api/v1/releases/:id - Get single release with indicator
  - Query params: indicator_id, from_date, to_date, limit, offset
  - Test: API returns correct data; respects date filters

- [x] T313 Add /api/v1/calendar endpoint
  - GET /api/v1/calendar - Get upcoming releases (default next 7 days)
  - Query params: days, country, category
  - Test: API returns same data as web calendar

- [x] T314 Add API usage tracking
  - Track API calls per key: endpoint, timestamp, response_time
  - Store in api_usage table or append to existing request_logs
  - Dashboard widget showing usage over time
  - Test: API calls are logged; dashboard displays usage

- [x] T315 Add API documentation page
  - Route: /docs/api
  - Interactive API explorer (Swagger UI or similar)
  - Code examples in multiple languages
  - Test: docs page renders; examples are accurate

---

## 2) Billing & Quotas

- [x] T320 Add plans table
  - Migration: plans(id, name, price_monthly, price_yearly, api_calls_limit, webhook_limit, features)
  - Seed plans: Free, Plus, Pro, Enterprise
  - Test: plans table populated with tiers

- [x] T321 Add subscriptions table
  - Migration: subscriptions(id, user_id, plan_id, stripe_subscription_id, status, current_period_end, created_at)
  - Status: 'active', 'canceled', 'past_due', 'trialing'
  - RLS: users can only read their own subscription
  - Test: subscription records created correctly

- [x] T322 Integrate Stripe for payments
  - Environment: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
  - Route: /api/stripe/webhook for Stripe events
  - Handle: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
  - Test: Stripe webhook updates subscription status

- [x] T323 Add billing page
  - Route: /settings/billing
  - Shows current plan, usage, upgrade options
  - Stripe Checkout integration for upgrades
  - Cancel subscription button
  - Test: can view plan; upgrade redirects to Stripe; cancellation works

- [x] T324 Add usage quota enforcement
  - Middleware checks API call count against plan limit
  - Returns 429 with upgrade prompt when quota exceeded
  - Reset counters monthly
  - Test: exceeding quota returns 429; reset works

- [x] T325 Add usage alerts
  - Email when usage reaches 80%, 90%, 100% of quota
  - Dashboard warning banner when approaching limit
  - Test: alerts sent at correct thresholds

---

## 3) Multi-Tenant Admin

- [x] T330 Add organizations table
  - Migration: organizations(id, name, slug, owner_id, created_at)
  - Unique slug for URL-friendly org names
  - Test: can create organization

- [ ] T331 Add organization_members table
  - Migration: organization_members(id, org_id, user_id, role, invited_at, joined_at)
  - Roles: 'owner', 'admin', 'member'
  - RLS: org members can read; org admins can write
  - Test: members can be added; RLS works correctly

- [ ] T332 Add organization management UI
  - Route: /org/:slug/settings
  - Invite members, assign roles, remove members
  - Transfer ownership
  - Test: member management works; ownership transfer works

- [ ] T333 Add organization-scoped watchlists
  - Add org_id column to watchlist table (nullable for personal)
  - Shared watchlists visible to all org members
  - Test: org watchlist visible to members; personal watchlist private

- [ ] T334 Add organization billing
  - Organization subscriptions separate from personal
  - Seat-based pricing for team plans
  - Billing admin role for payment management
  - Test: org subscription works; seats counted correctly

---

## 4) Additional Enhancements

- [ ] T340 Add data export functionality
  - Export watchlist releases to CSV/JSON
  - Export historical data for indicators
  - Test: exports contain correct data

- [ ] T341 Add calendar integrations
  - Generate iCal feed for watchlist releases
  - Google Calendar one-click add
  - Test: iCal feed valid; Google Calendar link works

- [ ] T342 Add mobile-responsive improvements
  - Audit and fix mobile layout issues
  - Add PWA manifest for app-like experience
  - Test: app works well on mobile devices

---

## Acceptance Criteria Summary

### Webhook Notifications
- Users can register webhook endpoints
- Webhooks fire when releases are published/revised
- Delivery attempts logged with retry logic

### Public REST API
- Versioned API at /api/v1/
- Full CRUD for indicators and releases
- API key authentication with usage tracking

### Billing & Quotas
- Stripe integration for payments
- Plan tiers with different limits
- Quota enforcement with alerts

### Multi-Tenant Admin
- Organizations with member management
- Shared watchlists within organizations
- Organization-level billing

### Enhancements
- Data export (CSV, JSON, iCal)
- Mobile PWA experience
