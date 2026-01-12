# Tasks — Macro Calendar L2

## Overview
L2 focuses on alerts, security enhancements, and API foundations.

---

## 0) Email Alerts

- [x] T200 Add alert_preferences table
  - Migration: alert_preferences(id, user_id, indicator_id, email_enabled, created_at, updated_at)
  - Constraint: unique(user_id, indicator_id)
  - RLS: users can only CRUD their own preferences
  - Test: insert preference row; verify RLS blocks other users

- [x] T201 Add alert preferences server actions
  - File: src/app/actions/alerts.ts
  - Actions: getAlertPreferences, updateAlertPreference, toggleEmailAlert
  - Test: actions modify alert_preferences table correctly

- [x] T202 Add AlertToggle component to watchlist items
  - Component: AlertToggle.tsx
  - States: loading, enabled, disabled
  - Shows on /watchlist page next to each indicator
  - Test: toggle updates alert preference; persists across page refresh

- [x] T203 Create email alert Edge Function
  - Supabase Edge Function: send-release-alert
  - Triggered by database webhook on releases table insert
  - Queries users with matching indicator in alert_preferences
  - Sends email via Resend/SendGrid
  - Test: inserting a release triggers email to subscribed users

- [x] T204 Add email alert unsubscribe link
  - Route: /unsubscribe?token=...
  - One-click unsubscribe without login required
  - Test: clicking unsubscribe link disables email alerts

---

## 1) Role-Based Admin Access

- [x] T210 Add user_roles table
  - Migration: user_roles(id, user_id, role, granted_at, granted_by)
  - Roles: 'admin', 'user' (default)
  - RLS: only admins can read/write user_roles
  - Test: verify RLS policies work correctly

- [x] T211 Add audit_log table
  - Migration: audit_log(id, user_id, action, resource_type, resource_id, metadata, created_at)
  - Actions: 'upload', 'role_change', 'delete'
  - No RLS (admin-only access via service role)
  - Test: audit log entries created on admin actions

- [x] T212 Refactor admin upload to use role-based auth
  - Replace ADMIN_UPLOAD_SECRET with Supabase auth + role check
  - Log all uploads to audit_log
  - Keep secret as fallback during migration period
  - Test: admin user can upload; non-admin user gets 403

- [x] T213 Add admin dashboard page
  - Route: /admin
  - Shows: recent uploads, audit log, user management
  - Requires admin role
  - Test: admin can view dashboard; non-admin redirected

- [x] T214 Add role management UI
  - Component: RoleManager.tsx
  - Admin can grant/revoke admin role
  - All changes logged to audit_log
  - Test: role changes reflected immediately; audit log updated

---

## 2) Rate Limiting & Abuse Protection

- [x] T220 Add rate limiting middleware
  - File: src/middleware.ts (extend existing)
  - Use Upstash Redis or similar for distributed rate limiting
  - Limits: 60 requests/minute for public, 30/minute for watchlist actions
  - Test: exceeding limit returns 429 with Retry-After header

- [x] T221 Add API key generation for authenticated users
  - Migration: api_keys(id, user_id, key_hash, name, created_at, last_used_at, revoked_at)
  - Route: /settings/api-keys
  - Actions: createApiKey, revokeApiKey
  - Test: can create/revoke API keys; revoked keys don't work

- [x] T222 Add request logging for abuse detection
  - Log: IP, user_id (if auth), endpoint, timestamp, response_code
  - Store in Supabase or external logging service
  - Test: requests are logged with all required fields

---

## 3) Revision Tracking

- [X] T230 Add revision history to releases table
  - Add column: revision_history jsonb default '[]'
  - Format: [{previous_actual, new_actual, revised_at}]
  - Test: updating actual value appends to revision_history

- [X] T231 Show revision diff on indicator detail page
  - Component: RevisionHistory.tsx
  - Shows timeline of revisions with old → new values
  - Test: revisions displayed correctly; empty state when no revisions

- [X] T232 Add revision badge to calendar row
  - Shows "Revised" badge when revision_history is non-empty
  - Tooltip shows latest revision details
  - Test: badge appears only for revised releases

---

## 4) Documentation & Polish

- [X] T240 Update SPEC.md with L2 user stories
  - Add email alerts, admin roles, rate limiting user stories
  - Test: spec reflects L2 features

- [X] T241 Update DEPLOY.md with L2 infrastructure
  - Add: Resend/SendGrid setup, Upstash Redis setup, Edge Functions deployment
  - Test: deployment docs accurate for L2 features

- [X] T242 Update CHANGELOG.md with L2 features
  - Document all L2 additions
  - Test: changelog complete

---

## Acceptance Criteria Summary

### Email Alerts
- Users can enable/disable email alerts per indicator
- Emails sent when new releases are published
- One-click unsubscribe without login

### Role-Based Admin
- Admin role replaces shared secret
- All admin actions logged to audit table
- Admin dashboard for user/upload management

### Rate Limiting
- Public endpoints rate limited
- API keys available for programmatic access
- Abuse attempts logged and blocked

### Revision Tracking
- Revision history preserved in database
- Diff view shows value changes over time
- Calendar indicates revised releases
