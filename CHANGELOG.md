# Changelog

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