# Changelog

## [Unreleased]

### Bug Fixes
- **Fixed:** "Received invalid data format from database" error on calendar and watchlist pages
  - Updated Zod schemas to handle Supabase embedded relation response format
  - Supabase returns embedded relations as arrays even for many-to-one joins
  - Created `embeddedIndicatorSchema` that accepts both array and single object formats
  - Applied to `/` (calendar page) and `/watchlist` page
- **Fixed:** "Received invalid data format from database" error on indicator detail page
  - Made `revision_history` Zod schema more resilient using `.catch([])` to handle null values

### Revision Tracking
- **Added:** RevisionHistory component to display revision timeline (T231)
  - Component: `src/app/components/RevisionHistory.tsx`
  - Shows timeline of revisions with old → new values for each release
  - Empty state displays "No revisions have been made to this release"
  - Sorted chronologically (oldest to newest) for timeline view
  - Displays timestamp, previous value (red), and new value (green) for each revision
  - Optional unit display after values
  - Accessible with proper ARIA labels and semantic markup
  - Integrated into indicator detail page (`/indicator/[id]`)
  - Unit tests for utility functions (15 tests)
- **Added:** Revision history tracking for releases (T230)
  - New column `revision_history` (JSONB, default `[]`) added to releases table
  - Migration: `010_add_revision_history.sql`
  - Format: `[{previous_actual, new_actual, revised_at}]`
  - Automatic trigger appends to revision_history when `actual` value is updated
  - Initial actual value set (null → value) is not tracked as revision
  - Same value updates are not tracked (actual must change)
  - Partial index for efficient queries on releases with revisions
  - Test file: `010_test_revision_history.sql` with verification queries

### Rate Limiting & Abuse Protection
- **Added:** Request logging for abuse detection (T222)
  - New database table `request_logs` with migration (`009_create_request_logs.sql`)
  - Schema: id, ip, user_id, endpoint, response_code, created_at
  - No RLS: admin-only access via service role (security monitoring data)
  - Indexes for IP-based queries, user lookups, endpoint analysis, and error patterns
  - Request logger module (`src/lib/request-logger.ts`):
    - `logRequest(entry)` - Async request logging (designed for `waitUntil()`)
    - `createLogEntry(ip, endpoint, responseCode, userId)` - Helper to create log entries
    - Uses cached Supabase client for efficient logging
    - Graceful error handling (logging failures never break the app)
  - Updated middleware to log requests with:
    - Client IP address (from Vercel headers or fallbacks)
    - User ID (if authenticated)
    - Endpoint (request pathname)
    - Response code (200 for successful middleware pass-through, 429 for rate-limited)
  - Environment variable: `ENABLE_REQUEST_LOGGING` (set to 'true' to enable)
  - `isRequestLoggingEnabled()` function in env.ts for checking logging status
  - Unit tests for request logger module (14 tests)
- **Added:** API key generation for authenticated users (T221)
  - New database table `api_keys` with migration (`008_create_api_keys.sql`)
  - Schema: id, user_id, key_hash, name, created_at, last_used_at, revoked_at
  - RLS policies: users can only manage their own API keys
  - Index on key_hash for efficient API authentication lookups
  - Server actions in `src/app/actions/api-keys.ts`:
    - `createApiKey(name)` - Generate secure random key, store SHA-256 hash, return plain key once
    - `revokeApiKey(keyId)` - Soft delete by setting revoked_at timestamp
    - `deleteApiKey(keyId)` - Hard delete key from database
    - `getApiKeys()` - List user's API keys (without exposing the key)
    - `validateApiKey(key)` - Validate API key for authentication, update last_used_at
  - Settings page at `/settings/api-keys` for key management:
    - Create new keys with custom names
    - View list of all keys with creation date, last used, and status
    - Revoke active keys (soft delete)
    - Delete revoked keys (hard delete)
    - Plain key shown only once after creation with copy button
    - Usage instructions with example Authorization header
  - Unit tests for all API key actions (26 tests)
  - Key format: `mc_{32 hex characters}` (40 chars total)
- **Added:** Rate limiting middleware (T220)
  - Extended `src/middleware.ts` to implement distributed rate limiting using Upstash Redis
  - Public routes: 60 requests per minute limit
  - Stricter routes (`/watchlist`, `/api/admin`): 30 requests per minute limit
  - Returns HTTP 429 with `Retry-After` header when limit exceeded
  - Rate limit headers added to all responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
  - Uses sliding window algorithm for smooth rate limiting
  - Identifies clients by IP address using `@vercel/functions` ipAddress helper
  - Falls back to `x-forwarded-for` and `x-real-ip` headers for non-Vercel deployments
  - Graceful degradation: rate limiting disabled when Upstash Redis not configured
- **Added:** Environment variables for rate limiting (`src/lib/env.ts`)
  - `UPSTASH_REDIS_REST_URL` - Upstash Redis REST API URL (optional)
  - `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST API token (optional)
  - `getRateLimitEnv()` function returns null if not configured
- **Added:** Unit tests for rate limiting environment functions (5 tests)
- **Dependencies:** Added `@upstash/ratelimit`, `@upstash/redis`, `@vercel/functions`

### Role-Based Admin Access
- **Added:** Role management UI in admin dashboard (T214)
  - `RoleManager.tsx` component for granting/revoking admin roles
  - Dropdown to select role (admin/user) for each user
  - Prevents admins from demoting themselves
  - Loading state shown during role updates
  - Success feedback after role change
  - "Actions" column added to Users table in admin dashboard
  - Server action `updateUserRole(userId, role)` in `src/app/actions/admin.ts`:
    - Validates input with Zod
    - Grants admin role via upsert to user_roles table
    - Revokes admin role via delete from user_roles table
    - Logs all role changes to audit_log with previous/new role metadata
  - Unit tests for `updateUserRole` action (10 tests)
- **Added:** Admin dashboard page at `/admin` (T213)
  - Displays recent uploads from audit log with user emails and file details
  - Shows user management table with email, role, and join date
  - Shows full audit log with all actions (upload, role_change, delete)
  - Server actions in `src/app/actions/admin.ts`:
    - `getRecentUploads(limit)` - Fetch recent upload entries from audit log
    - `getRecentAuditLog(limit)` - Fetch all recent audit log entries
    - `getUsers(limit)` - Fetch users with their roles from user_roles table
    - `getAdminDashboardData()` - Combined fetch for all dashboard data
  - Admin role protection: non-admin users are redirected to home page
  - Quick link to admin upload page from dashboard
  - Unit tests for admin server actions (14 tests)
- **Added:** user_roles table migration (`006_create_user_roles.sql`) (T210)
  - Schema: id, user_id, role, granted_at, granted_by
  - Roles: 'admin' or 'user' enforced via check constraint
  - Unique constraint on user_id (one role per user)
  - Foreign key to profiles with CASCADE delete for user_id
  - Foreign key to profiles with SET NULL for granted_by (tracks who granted the role)
  - RLS policies: only admins can read/write user_roles table
  - `is_admin()` helper function for checking admin status in RLS policies
- **Added:** Test file (`006_test_user_roles.sql`) with verification queries for T210
- **Added:** audit_log table migration (`007_create_audit_log.sql`) (T211)
  - Schema: id, user_id, action, resource_type, resource_id, metadata, created_at
  - Actions: 'upload', 'role_change', 'delete' enforced via check constraint
  - Foreign key to profiles with SET NULL (preserves audit entries when user deleted)
  - Indexes for user_id, action, resource, and created_at queries
  - No RLS: admin-only access via service role (tamper-proof audit trail)
- **Added:** Test file (`007_test_audit_log.sql`) with verification queries for T211
- **Refactored:** Admin upload to use role-based auth (`/api/admin/upload`) (T212)
  - Primary auth: Supabase auth + admin role check (via `checkAdminRole()` helper)
  - Fallback auth: ADMIN_UPLOAD_SECRET kept for migration period (now optional in env)
  - Audit logging: All successful uploads logged to audit_log table (via `logAuditAction()` helper)
  - Response includes `authMethod` field indicating how user was authenticated ('role' or 'secret')
  - Returns 403 Forbidden for authenticated non-admin users (was 401)
  - Returns 401 Unauthorized for unauthenticated users without valid secret
- **Added:** `checkAdminRole()` helper function (`src/lib/supabase/auth.ts`)
  - Checks if current authenticated user has admin role
  - Uses service role client to bypass RLS on user_roles table
  - Returns `AdminCheckResult` with `isAdmin`, `userId`, and optional `error`
- **Added:** `logAuditAction()` helper function (`src/lib/supabase/auth.ts`)
  - Logs admin actions to audit_log table using service role client
  - Supports action types: 'upload', 'role_change', 'delete'
  - Accepts optional resource_id and metadata for detailed logging
- **Changed:** ADMIN_UPLOAD_SECRET is now optional in server environment (`src/lib/env.ts`)
  - Role-based auth is the primary authentication method
  - Secret kept as fallback for migration period
- **Updated:** Admin upload page (`/admin/upload`)
  - New auth info banner explaining authentication methods
  - Secret input moved to collapsible section (optional fallback)
  - Success message shows which auth method was used
- **Added:** Unit tests for `checkAdminRole()` and `logAuditAction()` functions (10 tests)

### Bug Fixes
- **Fixed:** Email alert Edge Function not sending emails when release inserted
  - Fixed `generateUnsubscribeToken` function type mismatch in Edge Function
  - Function was declared to return `string` but actually returned `Promise<string>`
  - Changed function to properly use `async/await` pattern with correct return type
- **Fixed:** Magic link sign-in showing `?error=auth_failed` in URL despite successful authentication
  - Skip middleware session refresh for `/auth/callback` route
  - Root cause: Middleware called `getUser()` before callback could exchange code for session
  - The auth callback needs to establish the session first without interference from middleware
  - Added fallback: If code exchange fails but user is already authenticated, redirect to success
  - Added detailed error logging (message, status, code) for debugging auth callback issues

### Email Alerts
- **Fixed:** User sign-out issue persisting when using unsubscribe link
  - Skip middleware session refresh for `/unsubscribe` route to prevent cookie manipulation
  - Skip `getCurrentUser()` auth call in layout for `/unsubscribe` route
  - Added `x-pathname` header in middleware for route detection in layouts
  - Root cause: Multiple concurrent Supabase auth calls during unsubscribe could cause session token refresh conflicts
- **Fixed:** Unsubscribe failing with "An unexpected error occurred" when `ADMIN_UPLOAD_SECRET` env var not set
  - `createSupabaseServiceClient()` now only validates the `SUPABASE_SERVICE_ROLE_KEY` it needs
  - Previously it validated all server env vars via `getServerEnv()`, causing failures when unrelated vars were missing
- **Fixed:** User sign-out issue when using unsubscribe link (T204)
  - Created service role Supabase client (`src/lib/supabase/service-role.ts`) to bypass RLS without authentication
  - Updated `unsubscribeWithToken()` action to use service role client instead of regular server client
  - Prevents interference with user authentication cookies during unsubscribe operation
  - Added `SUPABASE_SERVICE_ROLE_KEY` environment variable requirement
- **Added:** One-click unsubscribe functionality (T204)
  - Unsubscribe page at `/unsubscribe?token=...` with no authentication required
  - HMAC-SHA256 signed unsubscribe tokens with 90-day expiration
  - Token utilities in `src/lib/unsubscribe-token.ts` for secure token generation/validation
  - Server actions: `getUnsubscribeToken()`, `unsubscribeWithToken(token)`
  - Comprehensive test coverage (15 tests for token utilities, 8 tests for unsubscribe actions)
  - Updated Edge Function to include personalized unsubscribe links in emails (HTML and text)
  - Environment variable: `UNSUBSCRIBE_TOKEN_SECRET` for token signing
  - Success/error/invalid UI states with helpful user feedback

### Testing & Development
- **Updated:** Test seed data now uses dynamic dates (`001_test_seed.sql`)
  - Release dates calculated using PostgreSQL date functions (CURRENT_TIMESTAMP + INTERVAL)
  - Eliminates need to manually update hardcoded dates when testing
  - Includes 5 scheduled releases spread across the next 7 days (1, 2, 3, 5, and 6 days from execution)
  - Includes 2 past releases for historical testing (6 and 12 hours ago)
  - Dates remain accurate regardless of when seed script is executed

## [1.2.3] - 2026-01-10

### Email Alerts
- **Added:** Email alert Edge Function (`supabase/functions/send-release-alert/index.ts`) (T203)
  - Triggered by database webhook on releases table INSERT
  - Queries users with email alerts enabled for the released indicator
  - Sends styled HTML email with release details via Resend API
  - Includes: indicator name, country, category, period, release date, actual/forecast/previous values
  - Email links to indicator detail page and watchlist management
- **Added:** Database migration for webhook trigger (`005_create_release_alert_webhook.sql`)
  - Enables pg_net extension for async HTTP requests
  - Documents both trigger-based and Dashboard webhook approaches
  - Recommends Dashboard webhook configuration for production
- **Updated:** DEPLOY.md with Edge Function deployment instructions
  - Section 8: Complete email alerts setup guide
  - Resend account setup and domain verification
  - Edge Function deployment commands
  - Database webhook configuration steps
  - Troubleshooting guide for email delivery issues

## [1.2.2] - 2026-01-10

### Email Alerts
- **Added:** AlertToggle component in watchlist (`src/app/components/AlertToggle.tsx`) (T202)
  - Toggle button for enabling/disabling email alerts per indicator
  - Three states: loading, enabled (blue bell icon), disabled (gray bell with slash)
  - Uses `toggleEmailAlert` server action to update preferences
  - Shows error messages when toggle fails
  - Prevents double-clicks during API calls
- **Updated:** Watchlist page to include AlertToggle component
  - Added "Alerts" column to watchlist table
  - Fetches alert preferences for all watchlist items
  - Each indicator row shows its current alert state
  - Alert preferences persist across page refreshes

## [1.2.1] - 2026-01-10

### Email Alerts
- **Added:** Alert preferences server actions (`src/app/actions/alerts.ts`) (T201)
  - `getAlertPreferences()` - Fetch all alert preferences for the current user
  - `updateAlertPreference(indicatorId, emailEnabled)` - Create or update alert preference
  - `toggleEmailAlert(indicatorId)` - Toggle email alert state for an indicator
  - Input validation with Zod UUID schema
  - Authentication checks with proper error handling
  - Foreign key violation handling for non-existent indicators
  - Upsert pattern for updateAlertPreference using conflict resolution
- **Added:** Unit tests for alert actions with 19 test cases covering all actions and edge cases

## [1.2.0] - 2026-01-08 - L2 Kickoff

### Project Transition
- **Milestone:** L1 marked as shipped; L2 development now in progress
- **Focus:** Email alerts, role-based admin access, rate limiting, revision tracking

### Database Migrations
- **Added:** alert_preferences table migration (`004_create_alert_preferences.sql`) (T200)
  - Schema: id, user_id, indicator_id, email_enabled, created_at, updated_at
  - Unique constraint on (user_id, indicator_id) prevents duplicate preferences
  - RLS policies ensure users can only CRUD their own preferences
  - Indexes for user lookups, indicator lookups, and email-enabled queries
  - Auto-update trigger for updated_at column
- **Added:** Test file for alert_preferences verification (`004_test_alert_preferences.sql`)

### Documentation Updates
- **Added:** TASKS_L2.md with structured L2 task definitions
  - T200-T204: Email alerts feature
  - T210-T214: Role-based admin access
  - T220-T222: Rate limiting and abuse protection
  - T230-T232: Revision tracking
  - T240-T242: Documentation polish
- **Updated:** ROADMAP.md - L1 marked shipped, L2 in progress, L3 planned
- **Updated:** SPEC.md - Added L2 user stories and data model (alert_preferences, user_roles, audit_log tables)
- **Updated:** AGENTS.md - Scope changed to L2, added L3 backlog references
- **Updated:** GITHUB_WORKFLOW.md - Milestones and labels updated for L2/L3
- **Updated:** Issue templates - Task template now references TASKS_L2.md
- **Updated:** PR template - Checklist now references L2 scope
- **Updated:** BACKLOG.md - Items moved to L3+ (API, billing, webhooks)
- **Completed:** T140, T141 marked as complete in TASKS_L1.md

## [1.1.0] - 2026-01-08

### Developer Workflow
- **Added:** GitHub workflow documentation (`GITHUB_WORKFLOW.md`)
  - Comprehensive guide for milestones (L0, L1, L2)
  - Label definitions with colors and usage guidelines
  - Issue and PR workflow best practices
  - Quick reference links and search queries
  - CLI commands for bulk label creation
- **Added:** Task issue template for development tasks
  - Structured template linking to TASKS_L1.md
  - Task ID, acceptance criteria, and test steps fields
- **Improved:** Bug report issue template
  - Added environment, severity, and better structure
  - Auto-applies `bug` label
- **Improved:** Feature request issue template
  - Added milestone selection and user story format
  - Auto-applies `enhancement` label
- **Added:** Issue template config with quick links
  - Links to ROADMAP.md, BACKLOG.md, and TASKS_L1.md
- **Improved:** PR template with label suggestions section
  - Checkbox list of common labels to apply
- **Docs:** Updated AGENTS.md with GitHub workflow section
- **Docs:** Updated README.md to reference workflow guide

## [1.0.0] - L1 Release - 2026-01-08

### User Accounts & Authentication
- **Added:** Magic link authentication with Supabase Auth
  - Email-based sign-in (no passwords required)
  - Auth callback route at `/auth/callback` for magic link redirect
  - Supports optional post-login redirect with security validation
- **Added:** User profiles table with auto-provisioning
  - Profile automatically created when user signs up
  - Row Level Security ensures users can only access their own profile
  - Helper function `getCurrentUser()` for user management
- **Added:** Auth middleware for session refresh
  - Session cookies refreshed on each request before expiration
- **Added:** Header component with UserMenu for authentication UI
  - Shows "Sign In" button when logged out
  - Shows user email and "Sign Out" button when logged in
  - Real-time auth state updates via Supabase subscription
- **Added:** AuthModal component with magic link sign-in
  - Modal opens when clicking "Sign In" button
  - Email validation with Zod
  - Accessible with keyboard navigation and ARIA labels
- **Improved:** Loading states for auth components prevent layout shift (T140)
  - UserMenu receives initial auth state from server-side rendering
  - Auth state passed from root layout → Header → UserMenu
  - No visual jump when auth state is resolved on page load

### Watchlist Features
- **Added:** Watchlist table with Row Level Security
  - Users can save indicators to their personal watchlist
  - Unique constraint prevents duplicate saves
  - RLS policies enforce users can only manage their own watchlist items
- **Added:** Watchlist server actions for managing saved indicators
  - `addToWatchlist(indicatorId)` - add indicator to watchlist
  - `removeFromWatchlist(indicatorId)` - remove from watchlist
  - `toggleWatchlist(indicatorId)` - toggle watchlist state
  - Input validation with Zod, authentication checks, error handling
- **Added:** WatchlistButton component
  - Available on indicator detail pages
  - Shows different states: loading, not authenticated (with tooltip), watching, not watching
  - Disabled with "Sign in to save" tooltip when logged out
- **Added:** Watchlist page at `/watchlist`
  - View all saved indicators with next release date and period
  - Redirects to home if not authenticated
  - Empty state with call-to-action when no indicators saved
  - Table shows: Indicator name (linked), Country, Category, Next Release, Period
- **Added:** "My Watchlist" toggle to calendar filters
  - Toggle only appears when user is authenticated
  - Filters calendar to show only watchlist indicators
  - Toggle state persists in URL (bookmarkable/shareable)
  - Combines with existing country, category, and search filters
  - Shows empty state when watchlist is empty

### Performance & Optimization
- **Performance:** Batched admin upload queries for improved performance
  - CSV upload now uses batch queries instead of N+1 queries per row
  - Reduced to 2-3 total queries for indicators + releases regardless of row count
  - Indicators are batch-fetched, then batch-inserted/updated
  - Releases are batch-fetched (chunked at 50), then batch-inserted/updated

### Security
- **Security:** Row Level Security policies included in migration files
  - RLS automatically enabled on fresh deployments
  - Public read-only access enforced; anon key cannot INSERT/UPDATE/DELETE
  - Users can only access their own profiles and watchlist items
- **Security:** Admin upload endpoint requires ADMIN_UPLOAD_SECRET
  - Requests without secret or with invalid secret receive 401 Unauthorized
  - Secret must be set in environment variables
- **Security:** Zod validation for all Supabase responses
  - Validates structure of releases and filter options data at runtime
  - Catches malformed database responses with clear error messages
  - Replaced unsafe type casts with schema-based validation

### Documentation & Deployment
- **Docs:** Comprehensive deployment guide (DEPLOY.md) with Vercel and Supabase setup
  - Step-by-step deployment checklist for new developers
  - Environment variable configuration guide
  - Security best practices including secret rotation
  - Monitoring tips and troubleshooting section
- **Docs:** Updated migration instructions to include all required migration files
  - Lists all four migration files in order: 001_create_tables, 002_create_profiles, 003_create_watchlist, plus optional test seed
  - Added dedicated troubleshooting section for "Unable to load watchlist data" error
  - Updated RLS verification section to list all four tables
- **Docs:** Added troubleshooting guide for magic link localhost redirect issue
  - Fixed Site URL configuration in Supabase Authentication settings
  - Updated section 1.5 with step-by-step Site URL configuration instructions
- **Docs:** Documentation scope updated to L1 (auth + watchlists)
  - SPEC, ROADMAP, README, DEPLOY, RISKS aligned to L1
  - L0 task/audit docs marked as archive
  - Backlog populated with L2 ideas
- **Docs:** Added MCP tools section to AGENTS.md
  - Instructions for using GitHub MCP for CI/PR/issue operations
  - Instructions for using Supabase MCP for schema and documentation lookups
  - Instructions for using Vercel MCP for deployment management

### Testing & Quality
- **Tests:** Added unit tests for CSV parser
  - Extracted CSV parser into reusable module at `src/lib/csv-parser.ts`
  - Added 30 unit tests covering: quoted fields, escaped quotes, empty fields, malformed rows
  - Set up Vitest testing framework with `npm test` script
- **Tests:** Unit tests for watchlist server actions
  - Tests for all actions and edge cases
  - Authentication checks and error handling validation

### Bug Fixes
- **Fixed:** Magic link authentication failing with "auth_failed" error
  - Changed middleware from `getClaims()` to `getUser()` to properly refresh session
  - Reference: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- **Fixed:** Production deployment 404 errors caused by conflicting vercel.json commands
  - Removed `cd macro-calendar &&` prefixes from installCommand and buildCommand
  - Root Directory setting in Vercel handles working directory automatically
- **Fixed:** Deployment 404 error - removed `outputDirectory` from vercel.json
  - For SSR Next.js apps, Vercel's builder handles output directories automatically
  - Manually setting `outputDirectory` causes 404 errors on routes

## [0.9.0] - L0 Release - 2025-12

### Calendar & Browse Features
- **Added:** Calendar page with release table showing upcoming releases (next 7 days)
  - Real-time data from Supabase (releases joined with indicators)
  - Displays: Date/Time, Indicator, Country, Category, Actual, Forecast, Previous, Revised
  - Actual values highlighted in green when released
- **Added:** Filter dropdowns for Country and Category
  - Filters use URL search params for bookmarkable/shareable state
  - Clear filters button appears when any filter is active
- **Added:** Search input for indicator name
  - Case-insensitive partial matching
  - Debounced input (300ms)
  - Combines with country and category filters
- **Added:** Indicator detail pages at `/indicator/[id]`
  - Displays indicator header with name, country, category, source link
  - Indicator names in calendar are clickable links
- **Added:** Historical releases table on indicator detail pages
  - Shows up to 200 releases ordered by date descending
  - Columns: Date, Period, Actual, Forecast, Previous, Revised
  - Empty state message when no releases exist

### Admin Features
- **Added:** Admin upload page at `/admin/upload` with CSV file upload form
  - File input, admin secret field, CSV format documentation
- **Added:** CSV upload POST endpoint at `/api/admin/upload`
  - Accepts multipart form data with CSV file
  - Validates CSV structure using Zod
  - Upserts indicators and inserts/updates releases
  - Returns detailed validation errors with row numbers

### Infrastructure & Quality
- **Added:** Supabase database schema (indicators and releases tables with indexes)
- **Added:** Environment variable validation with Zod (`src/lib/env.ts`)
  - Validation runs at startup via next.config.ts import (fail-fast on missing env vars)
- **Added:** Supabase client wrappers for server and client components
- **Added:** CI/CD pipeline via GitHub Actions
  - Runs lint, build, and security audit on every PR and push to main
  - Uses npm audit with high severity threshold
- **Added:** SEO metadata and dynamic page titles
  - Open Graph and Twitter card meta tags
  - Dynamic titles for indicator pages (e.g., "CPI (YoY) (US)")
  - Admin pages marked as noindex/nofollow
- **Added:** Empty states and loading states for better UX
  - Skeleton loading animations for Calendar and Indicator detail pages
  - Friendly "No upcoming releases" message when no results match filters
- **Improved:** Graceful error handling for database failures
  - Clear error messages when DB connection fails
  - Error displayed in red alert banner instead of blank table
- **Improved:** Added inline code comments for security and clarity
  - Documented SQL injection safety via parameterized queries
  - Explained timezone handling assumptions
- **Added:** Expanded root README with project overview, structure, quick start guide

## Unreleased

_(No unreleased changes)_