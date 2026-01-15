# Changelog

## [Unreleased]

### Bug Fixes
- **Fixed:** CME Group calendar import now properly reports errors when data source is unavailable
  - Previously, when CME's AJAX endpoint returned 404, the import silently returned 0 events with a "success" message
  - Now returns HTTP 503 with clear error message: "CME Group calendar data source is unavailable"
  - Added `dataSourceUnavailable` flag to import result for UI handling
  - Added `fetchErrors` array with detailed error information (month, status code, message)
  - Errors are properly logged and surfaced to the admin UI
  - Affects both `/api/admin/upcoming-import` and `/api/cron/sync-data` endpoints

### CME Group Calendar Integration (Replaces Paid APIs)
- **Major Change:** Replaced paid API dependencies (FMP, Finnhub, Trading Economics) with CME Group scraping
  - New `cme-calendar-client.ts`: Scrapes CME Group's Economic Releases Calendar
  - New `cme-import.ts`: Import logic with schedule change detection
  - No API keys required - uses web scraping of public CME calendar
  - Automatic schedule change tracking with alerts when events are rescheduled
- **Updated:** Admin UI now shows CME Group as the data source
  - Simplified UI - no API key configuration needed
  - Shows schedule changes detected during import
  - Displays supported countries and features
- **Updated:** Cron endpoint now uses CME import instead of paid APIs
- **Updated:** DEPLOY.md Section 15 rewritten for CME-based import
  - Removed references to FMP, Finnhub, Trading Economics API keys
  - Added schedule change detection documentation
  - Simplified setup - only CRON_SECRET needed
- **Added:** `cheerio` dependency for HTML parsing

### Scheduled Releases Setup (L4)
- **Added:** Complete documentation for configuring upcoming economic releases (T403.3)
  - New Section 15 in DEPLOY.md: "Scheduled Releases (Upcoming Events)"
  - No API key registration required
  - Manual import and automated cron sync options
  - Troubleshooting guide for common issues
- **Updated:** Environment variables table in DEPLOY.md
  - Removed `FMP_API_KEY`, `FINNHUB_API_KEY`, `TRADING_ECONOMICS_API_KEY` (no longer needed)
  - `CRON_SECRET` for Vercel Cron authentication

### Sub-Second Real-Time Updates (L4)
- **Added:** Supabase Realtime integration for sub-second data propagation (T400)
  - `useRealtimeReleases` React hook for live release updates
  - `useRealtimeIndicators` React hook for live indicator updates
  - `LiveIndicator` component showing real-time connection status
  - WebSocket subscription to releases and indicators tables
  - Database changes propagate to clients in < 500ms
- **Added:** Scheduled data sync via Vercel Cron (T403)
  - `/api/cron/sync-data` endpoint for automated syncing
  - Runs daily at 5:00 PM Central Time (23:00 UTC)
  - Protected by `CRON_SECRET` environment variable
  - `vercel.json` configured with cron schedule
  - Manual sync button in admin panel for on-demand syncs
- **Updated:** Calendar now shows 30 days by default (was 7 days) (T404)
  - Extended time range for upcoming releases
  - Updated empty state message

### Documentation
- **Simplified:** TASKS_L4.md completely rewritten
  - Consolidated verbose planning into actionable checklist format
  - Matches the clean structure of TASKS_L1, L2, and L3
  - Added clear data sources summary table with API keys
  - Focus on sub-second updates as the key goal
  - Removed redundant implementation details

### Documentation
- **Added:** G20 country coverage documentation in DEPLOY.md (Section 14)
  - Full list of all 20 G20 member economies and their data sources
  - Table showing which data sources cover each country
  - Additional countries beyond G20 also documented
- **Added:** Calendar integration documentation in DEPLOY.md (Section 13)
  - iCal/ICS feed export instructions
  - Google Calendar one-click add feature
  - API endpoint for programmatic iCal access with full documentation
- **Added:** Real-time data updates plan (T402) in TASKS_L4.md
  - **Target latency: < 1 minute from official release**
  - Aggressive polling strategy (10-15 second intervals during release windows)
  - US releases at 8:30 AM ET (employment, CPI, GDP)
  - EU releases at 2:15 PM CET (ECB decisions), 11:00 AM CET (HICP)
  - Vercel Cron with 1-minute intervals for release windows
  - Supabase Edge Functions for sub-minute polling
  - SSE/WebSocket for real-time client updates
  - 10 implementation tasks (T402.1 - T402.10)
- **Updated:** BACKLOG.md with new priorities
  - Confirmed G20 coverage is complete
  - Added real-time/fast data updates as high priority with 1-minute target
  - Reorganized priorities for clarity

### Data Acquisition (L4)
- **Added:** World Bank bulk import script for historical economic data (T401.4)
  - Script: `src/lib/data-import/world-bank-import.ts`
  - World Bank API client: `src/lib/data-import/world-bank-client.ts`
  - Imports historical data from World Bank Indicators API v2
  - No API key required (World Bank API is free and open)
  - Supports 16 key economic indicators:
    - GDP: GDP (Current USD), GDP Growth Rate, GDP Per Capita
    - Inflation: Inflation Rate (CPI), Consumer Price Index
    - Employment: Unemployment Rate, Labor Force Participation Rate
    - Trade: Exports, Imports (% of GDP), Current Account Balance
    - Finance: Foreign Direct Investment, Real Interest Rate
    - Government: Central Government Debt, Government Revenue (% of GDP)
    - Demographics: Total Population, Population Growth Rate
  - Covers 38 major economies:
    - G7 countries (US, UK, Germany, Japan, France, Italy, Canada)
    - Major emerging markets (China, India, Brazil, Russia)
    - Eurozone, Asia-Pacific, Latin America, and others
  - Features:
    - Rate limiting (500ms between requests for fair use)
    - Automatic deduplication using (indicator_id, release_at, period) key
    - Creates country-specific indicators (e.g., "GDP (Current USD) (United States)")
    - Progress tracking and error handling
    - Configurable start year (default: 2014, 10+ years)
    - Support for importing specific indicators or countries
  - Usage: `npx tsx src/lib/data-import/world-bank-import.ts`
  - Unit tests for World Bank client (19 tests) and import functionality (7 tests)
- **Added:** IMF bulk import script for historical economic data (T401.5)
  - Script: `src/lib/data-import/imf-import.ts`
  - IMF API client: `src/lib/data-import/imf-client.ts`
  - Imports historical data from IMF World Economic Outlook API
  - No API key required (IMF API is free and open)
  - Supports 15 key economic indicators:
    - GDP: Real GDP Growth Rate, GDP (Current USD), GDP Per Capita, GDP (PPP)
    - Inflation: Inflation Rate (CPI), Inflation Rate (End of Period)
    - Employment: Unemployment Rate, Employment
    - Trade: Current Account Balance (% of GDP and USD)
    - Government: Government Gross Debt (% of GDP), Net Lending/Borrowing
    - Investment: Total Investment (% of GDP), Gross National Savings
    - Demographics: Population
  - Covers 37 major economies:
    - G7 countries (US, UK, Germany, Japan, France, Italy, Canada)
    - Major emerging markets (China, India, Brazil, Russia)
    - Eurozone, Asia-Pacific, Latin America, and others
  - Features:
    - Rate limiting (1 second between requests for fair use)
    - Automatic deduplication using (indicator_id, release_at, period) key
    - Creates country-specific indicators (e.g., "Real GDP Growth Rate (%) (United States)")
    - Progress tracking and error handling
    - Configurable start/end year (default: 2014 to current year)
    - Support for importing specific indicators or countries
  - Usage: `npx tsx src/lib/data-import/imf-import.ts`
  - API route: `POST /api/admin/imf-import`
  - Unit tests for IMF client (13 tests) and import functionality (7 tests)

### Admin Features
- **Added:** World Bank import button in admin dashboard
  - New API route `/api/admin/world-bank-import` for triggering World Bank imports
  - New `WorldBankImportButton` component in admin dashboard
  - Shows available indicators and countries
  - One-click import for all configured World Bank indicators
  - Progress feedback during import
  - Import results display (inserted, updated, errors)
  - No API key required - World Bank API is free and open
- **Added:** IMF import button in admin dashboard
  - New API route `/api/admin/imf-import` for triggering IMF imports
  - New `IMFImportButton` component in admin dashboard
  - Shows available indicators (15) and countries (37)
  - One-click import for all configured IMF indicators
  - Progress feedback during import
  - Import results display (inserted, updated, errors)
  - No API key required - IMF API is free and open
  - Previously created BLS import API existed but button was missing from UI
  - New `BLSImportButton` component added to admin dashboard
  - Shows API key configuration status (with key: 500 queries/day, without: 25/day)
  - One-click import for all 17 configured US economic indicators
  - Progress feedback during import
- **Added:** ECB data import for Eurozone economic indicators (T401.3)
  - New ECB API client: `src/lib/data-import/ecb-client.ts`
  - ECB bulk import script: `src/lib/data-import/ecb-import.ts`
  - API route: `POST /api/admin/ecb-import`
  - No API key required (ECB SDW is free and open)
  - Supports 11 Eurozone economic indicators:
    - Interest Rates: ECB Main Refinancing Rate, Deposit Facility Rate
    - Inflation: Eurozone HICP (YoY), Core HICP, Germany/France/Italy/Spain HICP
    - GDP: Eurozone GDP Growth (QoQ)
    - Employment: Eurozone Unemployment Rate
    - Monetary: M3 Money Supply (YoY)
  - Features:
    - SDMX-JSON parsing for ECB Statistical Data Warehouse API
    - Rate limiting (500ms between requests for fair use)
    - Automatic deduplication using (indicator_id, release_at, period) key
    - Progress tracking and error handling
    - Configurable start period (default: 2014-01)
  - Unit tests for ECB client (16 tests) and import functionality (6 tests)
  - New `ECBImportButton` component in admin dashboard

### Admin Features
- **Added:** Admin UI for FRED data import (T401.7)
  - New `/api/admin/fred-import` endpoint for triggering FRED data import via API
  - GET endpoint returns FRED configuration status and available series
  - POST endpoint triggers import with optional series selection and start date
  - Admin authentication required for all operations
  - Detailed import results with success/failure counts
  - New `FredImportButton` component in admin dashboard (`/admin`)
  - Shows FRED API configuration status
  - One-click import for all 16 configured US economic indicators
  - Progress feedback during import
  - Import results display (inserted, updated, errors)
  - Instructions for setting up FRED API key if not configured
- **Added:** Clear historical/seed data functionality
  - New `ClearDataButton` component in admin dashboard
  - Server action `clearHistoricalData` in admin actions
  - Options to clear seed data, FRED data, or all data
  - Confirmation prompt for destructive operations
  - Audit logging for all data clear operations
- **Updated:** DEPLOY.md with FRED API key configuration and data import instructions
  - Added `FRED_API_KEY` to environment variables table
  - New Section 12: "Importing Real Economic Data (FRED)" with step-by-step guide
  - Troubleshooting guide for common FRED import issues

### Data Acquisition (L4)
- **Added:** Data validation and deduplication module (T401.6)
  - New validation module: `src/lib/data-import/validation.ts`
  - Zod schemas for FRED observation data validation
  - Numeric range validation with configurable min/max bounds
  - Outlier detection using standard deviation
  - Missing/invalid value handling with skip reasons
  - Deduplication by (indicator_id, release_at, period) key
  - Comprehensive test suite (30 tests)
  - Integrated into FRED import script for automatic validation
- **Added:** FRED bulk import script for historical economic data (T401.1)
  - Script: `src/lib/data-import/fred-import.ts`
  - FRED API client: `src/lib/data-import/fred-client.ts`
  - Imports historical data from FRED (Federal Reserve Economic Data) API
  - Supports 15+ key US economic indicators:
    - GDP: Real GDP, Real GDP Growth Rate
    - Inflation: CPI, Core CPI, PPI
    - Employment: Unemployment Rate, Non-Farm Payrolls, Initial Jobless Claims
    - Interest Rates: Federal Funds Rate, 10-Year Treasury, 2-Year Treasury
    - Consumer: Consumer Sentiment, Retail Sales
    - Housing: Housing Starts, Building Permits
    - Manufacturing: Industrial Production Index
  - Features:
    - Rate limiting support (120 requests/minute)
    - Automatic deduplication using (indicator_id, release_at, period) key
    - Creates indicators if they don't exist
    - Progress tracking and error handling
    - Configurable start date (default: 2014-01-01, 10+ years of data)
    - Support for importing specific series or all configured series
  - Usage: `npx tsx src/lib/data-import/fred-import.ts`
  - Environment variable: `FRED_API_KEY` (get free at https://fred.stlouisfed.org/docs/api/api_key.html)
  - Unit tests for FRED client (15 tests) and import functionality (5 tests)
- **Added:** BLS bulk import script for historical economic data (T401.2)
  - Script: `src/lib/data-import/bls-import.ts`
  - BLS API client: `src/lib/data-import/bls-client.ts`
  - Imports historical data from BLS (Bureau of Labor Statistics) API v2
  - Supports 17 key US economic indicators:
    - Employment: Unemployment Rate, Labor Force Participation Rate, Employment Level
    - Unemployment Demographics: Black/African American, Hispanic/Latino
    - Consumer Prices: CPI All Items, Core CPI, Food, Shelter, New Vehicles, Gasoline
    - Producer Prices: PPI Final Demand, PPI Core (Less Foods and Energy)
    - Payrolls: Total Nonfarm Employment, Average Hourly Earnings, Average Weekly Hours
  - Features:
    - Rate limiting support (25 queries/day without API key, 500 with key)
    - Year chunking for large date ranges (10 years without key, 20 with key)
    - Automatic deduplication using (indicator_id, release_at, period) key
    - Creates indicators if they don't exist
    - Progress tracking and error handling
    - Configurable start/end year (default: 2014 to current year)
    - Support for importing specific series or all configured series
    - Works without API key (reduced limits)
  - Usage: `npx tsx src/lib/data-import/bls-import.ts`
  - Environment variable: `BLS_API_KEY` (optional, register at https://data.bls.gov/registrationEngine/)
  - Unit tests for BLS client (20 tests) and import functionality (6 tests)
  - New API route: `/api/admin/bls-import`
    - GET endpoint returns BLS configuration status and available series
    - POST endpoint triggers import with optional series selection and date range
    - Admin authentication required for all operations

### Navigation & UX (L3)
- **Added:** Settings dropdown menu in header for authenticated users
  - Accessible via settings gear icon next to user email
  - Links to API Documentation, API Keys, Webhooks, Billing, and Watchlist
  - Dropdown closes when clicking outside
  - Proper ARIA attributes for accessibility (role="menu", aria-haspopup, aria-expanded)
  - Dark mode support
- **Added:** API Docs link for unauthenticated users in header
  - Visible next to Sign In button for easy discovery

### Documentation & Planning
- **Updated:** ROADMAP.md - L3 marked as Shipped, L4 added with data acquisition priorities
- **Added:** TASKS_L4.md with comprehensive plans for:
  - T400: Free live global data acquisition strategy
  - T401: Free historical global data acquisition strategy
  - Detailed source documentation for FRED, BLS, ECB, World Bank, IMF, OECD
  - Implementation phases and technical architecture
- **Updated:** BACKLOG.md - L3 marked complete, L4 priorities documented

### Additional Enhancements (L3)
- **Added:** Mobile-responsive improvements and PWA support (T342)
  - PWA manifest (`public/manifest.json`) for app-like mobile experience:
    - App name, short name, description
    - Theme color (#2563eb) matching brand
    - Standalone display mode for full-screen app experience
    - Portrait-primary orientation for mobile
    - Icons in 192x192 and 512x512 sizes
    - Finance/business/productivity categories
  - App icons:
    - `public/icons/icon-192.png` - Standard PWA icon
    - `public/icons/icon-512.png` - High-resolution PWA icon
    - `public/icons/apple-touch-icon.png` - iOS home screen icon
    - `public/icons/icon.svg` - Source vector icon
  - Layout metadata updates (`src/app/layout.tsx`):
    - Viewport configuration with proper mobile scaling
    - Theme color meta tags for browser UI theming
    - Apple Web App capable meta tags
    - Format detection disabled for telephone numbers
    - Manifest link for PWA installation
  - Mobile layout fixes:
    - Header: Stacks vertically on small screens with reduced padding
    - CalendarFilters: Grid layout on mobile, flex on desktop
    - Calendar table: Mobile scroll hint, reduced padding, smaller text
    - UserMenu: Truncates long emails on mobile, smaller button sizes
    - Status badges: Compact sizing on mobile
- **Added:** Calendar integrations for watchlist (T341)
  - Generate iCal/ICS feed for watchlist releases
  - Google Calendar one-click add for individual events
  - iCal generation library (`src/lib/ical.ts`):
    - RFC 5545 compliant iCalendar format
    - Proper text escaping for special characters
    - Line folding for long content
    - UTC timezone support
    - Google Calendar URL generation
  - API endpoint:
    - `GET /api/calendar/ical` - Download iCal feed for watchlist releases (auth required)
  - Server actions in `src/app/actions/calendar.ts`:
    - `exportWatchlistToICal()` - Export upcoming watchlist releases as iCal file
    - `getWatchlistCalendarEvents()` - Get releases with Google Calendar URLs
  - UI components:
    - `CalendarIntegration` component with iCal download button
    - `GoogleCalendarButton` component for one-click add to Google Calendar
    - Calendar integration buttons added to watchlist page header
    - Google Calendar link added to each release row in watchlist table
  - iCal features:
    - Includes indicator name, country, category in event title
    - Event description includes period, forecast, and previous values
    - 30-minute default event duration for economic releases
    - Maximum 500 releases per iCal feed
  - Unit tests for iCal utilities (47 tests) and calendar actions (11 tests)
- **Added:** Data export functionality (T340)
  - Export watchlist releases to CSV/JSON format
  - Export historical data for individual indicators to CSV/JSON format
  - API endpoints:
    - `GET /api/export/watchlist?format=csv|json` - Export watchlist releases (auth required)
    - `GET /api/export/indicators/:id?format=csv|json` - Export indicator history (public)
  - Server actions in `src/app/actions/export.ts`:
    - `exportWatchlistReleases(format)` - Export user's watchlist releases
    - `exportIndicatorHistory(indicatorId, format)` - Export indicator historical data
  - UI components:
    - `ExportButton` component with CSV/JSON download buttons
    - Export button added to watchlist page header (when watchlist has items)
    - Export button added to indicator detail page historical releases section
  - Export features:
    - CSV format with proper escaping for special characters
    - JSON format with structured data including metadata
    - Filename includes indicator name (sanitized) and date
    - Maximum 1,000 releases per export to prevent oversized files
  - Unit tests for export actions (15 tests)

### Multi-Tenant Admin (L3)
- **Added:** Organization billing support (T334)
  - Organizations can now have their own subscriptions separate from personal subscriptions
  - Seat-based pricing for team plans with configurable seat counts
  - New billing_admin role for payment management without full admin access
  - Migration `021_add_org_subscriptions.sql`:
    - Added `org_id` column to subscriptions table (nullable for personal subscriptions)
    - Added `seat_count` column for tracking purchased seats
    - Added unique index on org_id for one subscription per organization
    - Updated RLS policies for organization subscription access
    - Added `is_org_billing_admin()` helper function for billing permissions
    - Extended organization_members role check to include 'billing_admin'
  - Migration `022_add_team_plans.sql`:
    - Added team plan columns: is_team_plan, seat_price_monthly, seat_price_yearly, min_seats, max_seats
    - Seeded three team plans: Team Plus, Team Pro, Team Enterprise
    - Team Plus: $14.99/mo base + $7.99/seat, 5K API calls, 10 webhooks
    - Team Pro: $49.99/mo base + $19.99/seat, 50K API calls, 50 webhooks
    - Team Enterprise: $149.99/mo base + $29.99/seat, 500K API calls, 200 webhooks
  - Server actions in `src/app/actions/billing.ts`:
    - `getTeamPlans()` - Fetch all available team plans
    - `getOrgSubscription(orgId)` - Get organization's subscription with seat/member counts
    - `isOrgBillingAdmin(orgId)` - Check if user can manage organization billing
    - `getOrgSeatCount(orgId)` - Get purchased seats and current member count
    - `createOrgCheckoutSession(orgId, planId, seatCount, interval)` - Create Stripe checkout for org
    - `cancelOrgSubscription(orgId)` - Cancel organization subscription at period end
    - `updateOrgSeats(orgId, newSeatCount)` - Update seat count with Stripe quantity sync
  - Organization billing UI at `/org/[slug]/settings/billing`:
    - Current plan display with seat usage bar
    - Seat management for adding/removing seats
    - Team plan selection with seat count calculator
    - Billing admin permission check
    - Cancel subscription with confirmation
  - Updated OrganizationSettingsClient with billing_admin role:
    - New role badge styling (green)
    - Role selector includes billing_admin option
    - Role descriptions updated
  - Updated Stripe webhook to handle organization subscriptions:
    - Reads org_id and seat_count from checkout session metadata
    - Creates organization subscription with correct org_id and seat_count
- **Added:** Organization-scoped watchlists (T333)
  - Migration: `020_add_org_watchlists.sql`
  - Added `org_id` column to watchlist table (nullable for personal watchlists)
  - NULL org_id = personal watchlist, non-NULL org_id = shared org watchlist
  - Helper function: `is_org_member(org_id)` for RLS policy checks
  - Updated RLS policies:
    - Users can read personal watchlists AND org watchlists they belong to
    - Users can insert to personal watchlists OR org watchlists where they are admin/owner
    - Same pattern for update and delete operations
  - Updated unique constraints:
    - Personal watchlists: unique per user + indicator
    - Org watchlists: unique per org + indicator
  - Server actions in `src/app/actions/watchlist.ts`:
    - `addToOrgWatchlist(orgId, indicatorId)` - Add indicator to org watchlist (admin/owner only)
    - `removeFromOrgWatchlist(orgId, indicatorId)` - Remove from org watchlist (admin/owner only)
    - `getOrgWatchlist(orgId)` - List all org watchlist items (any org member)
    - `toggleOrgWatchlist(orgId, indicatorId)` - Toggle indicator in org watchlist (admin/owner only)
  - Unit tests for all organization watchlist actions (27 tests)
  - Test file: `020_test_org_watchlists.sql` for migration verification
- **Added:** Organization management UI at `/org/[slug]/settings` (T332)
  - Route: `/org/:slug/settings` with authentication and membership verification
  - Invite members form with email input and role selection (admin/member)
  - Member list display with role badges and joined date
  - Change role functionality for admins (member ↔ admin)
  - Remove member functionality with confirmation dialog
  - Transfer ownership button (owner only) to make another member the owner
  - Leave organization functionality for non-owners
  - Role permissions reference section explaining Owner/Admin/Member roles
  - Server actions in `src/app/actions/organizations.ts`:
    - `getOrganization(slug)` - Fetch organization by slug
    - `getCurrentUserRole(orgId)` - Get current user's role in organization
    - `listOrganizationMembers(orgId)` - List all members with profile info
    - `inviteMember(orgId, {email, role})` - Invite new member by email
    - `updateMemberRole(memberId, newRole)` - Change member's role
    - `removeMember(memberId)` - Remove member from organization
    - `transferOwnership(orgId, newOwnerUserId)` - Transfer ownership to another member
    - `leaveOrganization(orgId)` - Leave organization voluntarily
  - Unit tests for all organization actions (41 tests)
- **Added:** Organizations table for multi-tenant team features (T330)
  - Migration: `018_create_organizations.sql`
  - Schema: id, name, slug (unique, URL-friendly), owner_id (FK to profiles), created_at
  - Foreign key behavior: CASCADE on owner deletion (removes organization when owner is deleted)
  - RLS policies:
    - Users can read their own organizations
    - Users can create organizations (must be the owner)
    - Owners can update their own organizations
    - Owners can delete their own organizations
  - Indexes: slug (for URL lookups), owner_id (for user's organizations)
- **Added:** Test file for organizations verification (`018_test_organizations.sql`)
- **Added:** Organization members table for team membership management (T331)
  - Migration: `019_create_organization_members.sql`
  - Schema: id, org_id (FK to organizations), user_id (FK to profiles), role, invited_at, joined_at
  - Roles: 'owner', 'admin', 'member' (enforced by CHECK constraint)
  - Foreign key behavior: CASCADE on org deletion, CASCADE on user deletion
  - Unique constraint: (org_id, user_id) - one membership per user per organization
  - RLS policies:
    - Org members can read their organization's member list
    - Org admins and owners can add new members
    - Org admins and owners can update member roles
    - Org admins and owners can remove members
  - Indexes: org_id (for org member lookups), user_id (for user's memberships), role (for role queries)
  - Helper function: `is_org_admin(org_id)` for RLS policy checks
- **Updated:** Organizations RLS to allow org members to read (not just owners)
- **Added:** Test file for organization_members verification (`019_test_organization_members.sql`)

### Billing & Quotas (L3)
- **Added:** Usage alerts for approaching quota limits (T325)
  - Email alerts sent when API usage reaches 80%, 90%, and 100% of monthly quota
  - Usage warning banner displayed in dashboard when approaching limit:
    - Amber banner at 80% usage
    - Orange banner at 90% usage
    - Red banner at 100% usage (quota exceeded)
  - Banner includes usage progress bar, current usage count, and link to upgrade
  - Banner can be dismissed per session
  - Edge Function `send-usage-alert` handles email delivery with styled templates
  - Database table `usage_alerts_sent` prevents duplicate alerts per billing period
  - Server actions: `getUsageStatus()`, `checkAndTriggerUsageAlerts(userId)`
  - Unit tests for usage alert functionality (12 new tests)
- **Added:** API usage quota enforcement (T324)
  - Middleware checks API call count against user's plan limit before each API request
  - Returns HTTP 429 with upgrade prompt when monthly quota exceeded
  - Response includes detailed quota information:
    - Current usage count
    - Plan limit
    - Reset date (first of next month)
    - Plan name
  - Quota resets monthly on the first of each month (UTC)
  - Default Free tier: 100 API calls/month
  - Users without subscription default to Free tier limits
  - Graceful degradation: API requests allowed if quota check fails (fail-open)
- **Added:** Quota checking module (`src/lib/api/quota.ts`)
  - `checkApiQuota(userId)` - Check if user has exceeded their monthly API quota
  - `formatQuotaExceededMessage(result)` - Format user-friendly error message with upgrade prompt
  - Queries user's subscription plan from `subscriptions` table
  - Counts API calls from `request_logs` table for current billing period
- **Updated:** API authentication module (`src/lib/api/auth.ts`)
  - `authenticateApiRequest()` now checks quota after API key validation
  - Returns 429 QUOTA_EXCEEDED error when quota is exceeded
  - `ApiErrorResponse` type includes optional `quota` field with usage details
  - `createApiErrorResponse()` accepts optional quota parameter for 429 responses
- **Added:** Unit tests for quota enforcement (13 tests)
  - Tests for `checkApiQuota()` with various scenarios
  - Tests for `formatQuotaExceededMessage()` formatting
  - Tests for quota enforcement in API authentication flow
- **Added:** Billing page at `/settings/billing` (T323)
  - Displays current subscription plan with status badges (Active, Canceling, Past Due, Trial)
  - Shows API usage with progress bar and monthly quota
  - Plan upgrade options with monthly/yearly billing toggle
  - Stripe Checkout integration for plan upgrades
  - Cancel subscription button with confirmation dialog
  - Reactivate subscription for canceled plans (within billing period)
  - Feature lists for each plan tier
  - Help section with support contact
- **Added:** Billing server actions (`src/app/actions/billing.ts`)
  - `getPlans()` - Fetch all available subscription plans
  - `getCurrentSubscription()` - Get user's current subscription with plan details
  - `getApiUsage()` - Get API call count for current billing period
  - `createCheckoutSession(planId, interval)` - Create Stripe Checkout session for upgrades
  - `cancelSubscription()` - Cancel at period end via Stripe API
  - `reactivateSubscription()` - Remove cancellation for active period subscriptions
- **Added:** Unit tests for billing actions (22 tests)
  - Tests for all billing actions with authentication and error handling
  - Stripe API mocking for checkout and subscription management
- **Fixed:** "No Stripe price configured" error when upgrading plans
  - Stripe price IDs can now be configured via environment variables as fallback
  - New environment variables: `STRIPE_PRICE_{PLAN}_{INTERVAL}` (e.g., `STRIPE_PRICE_PLUS_MONTHLY`)
  - Price IDs in database `features` JSONB field still take precedence if set
  - Updated error message to include environment variable name for easier configuration
- **Added:** `getStripePriceEnv()` function in `src/lib/env.ts`
  - Returns Stripe price IDs from environment variables for Plus, Pro, and Enterprise plans
  - Supports both monthly and yearly billing intervals
- **Added:** Unit tests for Stripe price environment configuration (6 tests)

### Documentation
- **Clarified:** Stripe webhook testing instructions for `checkout.session.completed` event
  - Added note that `stripe trigger checkout.session.completed` creates a payment-mode session without a subscription
  - No DB insert occurs by design when session lacks subscription (this is correct behavior)
  - To test subscription webhooks, use `stripe trigger customer.subscription.updated` instead

## [2.5.0] - 2026-01-13

### Billing & Quotas (L3)
- **Added:** Stripe payment integration for subscriptions (T322)
  - Webhook endpoint: `POST /api/stripe/webhook` for handling Stripe events
  - Handled events:
    - `checkout.session.completed` - Creates/updates subscription when checkout completes
    - `customer.subscription.updated` - Updates subscription status and billing period
    - `customer.subscription.deleted` - Marks subscription as canceled
  - Security: Webhook signature verification using STRIPE_WEBHOOK_SECRET
  - Uses service role client to bypass RLS for subscription updates
  - Graceful error handling - acknowledges events even on processing errors to prevent retries
- **Added:** Stripe environment variables (`src/lib/env.ts`)
  - `STRIPE_SECRET_KEY` - Server-side Stripe API key
  - `STRIPE_WEBHOOK_SECRET` - Used to verify webhook signatures
  - `getStripeEnv()` function returns null if not configured (graceful degradation)
- **Added:** Unit tests for Stripe webhook handler (8 tests)
  - Configuration error handling (missing env vars, missing signature)
  - Signature verification (invalid signatures rejected)
  - Event handling (checkout.session.completed, subscription.updated, subscription.deleted)
  - Unhandled events acknowledged without error
- **Dependency:** Added `stripe@20.1.2` for Stripe API integration

## [2.4.0] - 2026-01-13

### Billing & Quotas (L3)
- **Added:** Subscriptions table for user billing (T321)
  - Migration: `016_create_subscriptions.sql`
  - Schema: id, user_id (FK to profiles), plan_id (FK to plans), stripe_subscription_id, status, current_period_end, created_at
  - Status values: 'active', 'canceled', 'past_due', 'trialing' (enforced by CHECK constraint)
  - Foreign key behavior: CASCADE on user deletion, RESTRICT on plan deletion (cannot delete plans with active subscriptions)
  - RLS: users can only read their own subscription; all writes managed via service role (Stripe webhooks)
  - Indexes: user_id, status, stripe_subscription_id for efficient queries
- **Added:** Test file for subscriptions verification (`016_test_subscriptions.sql`)
- **Updated:** Migration README with subscriptions table documentation

## [2.3.0] - 2026-01-13

### Billing & Quotas (L3)
- **Added:** Plans table for subscription tiers (T320)
  - Migration: `015_create_plans.sql`
  - Schema: id, name, price_monthly, price_yearly, api_calls_limit, webhook_limit, features (JSONB)
  - RLS: public read access (plans are public information), admin-only write via service role
  - Seeded with four tiers:
    - **Free:** $0/mo, 100 API calls/mo, 1 webhook endpoint
    - **Plus:** $9.99/mo ($99.90/yr), 1,000 API calls/mo, 5 webhook endpoints
    - **Pro:** $29.99/mo ($299.90/yr), 10,000 API calls/mo, 20 webhook endpoints
    - **Enterprise:** $99.99/mo ($999.90/yr), 100,000 API calls/mo, 100 webhook endpoints
  - Features JSONB includes: email_alerts, api_access, priority_support, data_export, dedicated_support, sla, support level
- **Added:** Test file for plans verification (`015_test_plans.sql`)
- **Updated:** Migration README with plans table documentation

## [2.2.1] - 2026-01-13

### Fixes
- **Fixed:** API documentation page UX improvements
  - Added `type="button"` attribute to all interactive buttons for proper accessibility
  - Added visual feedback for copy button - shows "Copied!" with green styling for 2 seconds after copying
  - All buttons now properly prevent accidental form submissions

## [2.2.0] - 2026-01-13

### Public REST API (L3)
- **Added:** API documentation page at `/docs/api` (T315)
  - Interactive API explorer with endpoint selection
  - Endpoints grouped by category (Indicators, Releases, Calendar)
  - Parameter inputs with validation hints (min/max, defaults)
  - Live code examples in multiple languages:
    - cURL
    - JavaScript/fetch
    - Python/requests
  - Collapsible documentation sections:
    - Authentication guide with API key usage
    - Rate limits per subscription tier (Free, Pro, Enterprise)
    - Error handling with HTTP status codes
  - Copy to clipboard functionality for code examples
  - Link to download OpenAPI 3.0 specification
  - Dark mode support
- **Added:** `/api/openapi` endpoint to serve OpenAPI specification as JSON
  - Static generation for optimal caching
  - 1-hour cache headers for CDN optimization
- **Added:** Unit tests for API docs components (15 tests)
  - Endpoint extraction from OpenAPI spec
  - Parameter resolution ($ref and inline)
  - Code example generation (URL building, encoding)
  - Rate limit tier validation

## [2.1.0] - 2026-01-13

### Public REST API (L3)
- **Added:** API usage tracking for per-key statistics (T314)
  - Database migration `014_add_api_usage_tracking.sql`:
    - Added `api_key_id` column to `request_logs` table (FK to api_keys)
    - Added `response_time_ms` column for performance monitoring
    - Indexes for efficient usage queries by API key
  - Request logger updates (`src/lib/request-logger.ts`):
    - `RequestLogEntry` now supports `api_key_id` and `response_time_ms` fields
    - New `createApiLogEntry()` function for API-specific logging
  - API authentication updates (`src/lib/api/auth.ts`):
    - `authenticateApiRequest()` now returns both `userId` and `apiKeyId`
    - `ApiAuthResult` includes `apiKeyId` field for usage tracking
  - API usage logger (`src/lib/api/usage-logger.ts`):
    - `logApiUsage()` function logs API requests with response time
    - Calculates response time from request start timestamp
    - Extracts client IP and endpoint path from request
  - All API v1 routes updated to log usage:
    - `/api/v1/indicators` - List and single indicator endpoints
    - `/api/v1/releases` - List and single release endpoints
    - `/api/v1/calendar` - Calendar endpoint
    - All responses logged with status code and response time
    - Failed auth attempts also logged for security monitoring
  - Server actions (`src/app/actions/api-usage.ts`):
    - `getApiKeyUsage(keyId, days)` - Usage stats for specific API key
    - `getAllApiKeysUsage(days)` - Aggregated stats for all user's keys
    - Returns: total calls, successful/error calls, avg response time
    - Daily usage breakdown for charts
    - Endpoint usage breakdown with counts and avg response times
    - Configurable period (1-90 days, default 30)
  - Dashboard widget (`src/app/settings/api-keys/ApiUsageDashboard.tsx`):
    - Shows total calls, successful, errors, and avg response time
    - Daily usage bar chart (last 14 days)
    - Top 5 endpoints by usage with response times
    - Period selector (7, 30, or 90 days)
  - Integrated into API Keys settings page (`/settings/api-keys`)
- **Updated:** Test files with usage logger mocks for API route tests

## [2.0.9] - 2026-01-13

### Public REST API (L3)
- **Added:** `/api/v1/calendar` endpoint for upcoming releases (T313)
  - `GET /api/v1/calendar` - Get upcoming releases for specified time period
  - Query parameters: days (1-90, default 7), country, category
  - Requires valid API key in `Authorization: Bearer mc_xxx` header
  - Returns `data` array of CalendarEvent objects and `meta` object with date range info
  - CalendarEvent includes: release_id, release_at, indicator_id, indicator_name, country_code, category, period, forecast, previous, actual, has_revisions
  - Meta object includes: from_date, to_date, total_events
  - Country filter auto-uppercase conversion (e.g., `us` → `US`)
  - Results ordered by release_at ascending (chronological order)
- **Added:** Unit tests for calendar API (14 tests)
  - Authentication tests (missing/invalid API key)
  - Parameter validation tests (days range, invalid values)
  - Successful response tests (date filters, country/category filters, revision detection)
  - Error handling tests (database errors)

## [2.0.8] - 2026-01-13

### Public REST API (L3)
- **Added:** `/api/v1/releases` endpoint for listing releases (T312)
  - `GET /api/v1/releases` - List releases with pagination
  - Query parameters: indicator_id, from_date, to_date, limit (1-100, default 20), offset
  - Requires valid API key in `Authorization: Bearer mc_xxx` header
  - Returns paginated response with `data` array and `pagination` metadata
  - Each release includes embedded `indicator` object with full indicator details
  - Date filters use ISO 8601 format (e.g., `2024-01-01T00:00:00Z`)
  - Results ordered by release_at descending (most recent first)
- **Added:** `/api/v1/releases/:id` endpoint for single release details (T312)
  - `GET /api/v1/releases/:id` - Get single release with indicator
  - Path parameter: `id` (UUID format required)
  - Returns release details with embedded `indicator` object
  - Includes revision_history when present
  - Returns 404 for non-existent releases
- **Added:** Unit tests for releases API (25 tests)
  - Authentication tests (missing/invalid API key)
  - Parameter validation tests (limit, offset, indicator_id UUID, date formats)
  - Successful response tests (pagination, filters, indicator embedding)
  - Error handling tests (database errors, not found)

## [2.0.7] - 2026-01-12

### Public REST API (L3)
- **Added:** `/api/v1/indicators` endpoint for listing indicators (T311)
  - `GET /api/v1/indicators` - List all indicators with pagination
  - Query parameters: country, category, search, limit (1-100, default 20), offset
  - Requires valid API key in `Authorization: Bearer mc_xxx` header
  - Returns paginated response with `data` array and `pagination` metadata
  - Country filter auto-uppercase conversion (e.g., `us` → `US`)
  - Case-insensitive search on indicator names using ILIKE
- **Added:** `/api/v1/indicators/:id` endpoint for single indicator details (T311)
  - `GET /api/v1/indicators/:id` - Get indicator with latest releases
  - Path parameter: `id` (UUID format required)
  - Query parameters: include_releases (default true), releases_limit (1-100, default 10)
  - Returns indicator details with optional `releases` array (most recent first)
  - Includes revision_history for releases when present
  - Returns 404 for non-existent indicators
- **Added:** API key authentication module (`src/lib/api/auth.ts`)
  - `validateApiKeyFromHeader(request)` - Validates API key from Authorization header
  - `authenticateApiRequest(request)` - Wrapper returning error response or user ID
  - `createApiErrorResponse(error, code, status)` - Standardized error responses
  - Supports both `Bearer mc_xxx` and direct `mc_xxx` header formats
  - Updates `last_used_at` timestamp on successful validation
  - Returns proper 401 for missing, invalid, or revoked API keys
- **Added:** Unit tests for indicators API (22 tests)
  - Authentication tests (missing/invalid API key)
  - Parameter validation tests (limit, offset, releases_limit, UUID format)
  - Successful response tests (pagination, filters, releases inclusion)
  - Error handling tests (database errors, not found)
- **Added:** Unit tests for API auth module (13 tests)
  - API key extraction and validation
  - Error response creation
  - Request authentication wrapper

## [2.0.6] - 2026-01-12

### Public REST API (L3)
- **Added:** OpenAPI 3.0.3 specification for versioned REST API (T310)
  - File: `src/lib/api/openapi.ts`
  - Defines endpoints: `/api/v1/indicators`, `/api/v1/releases`, `/api/v1/calendar`
  - Documents API key authentication (Bearer token)
  - Specifies pagination, filtering, and error response formats
  - Includes complete schema definitions for Indicator, Release, CalendarEvent
- **Added:** Rate limit tiers documentation
  - Free tier: 30 requests/minute, 1,000/month
  - Pro tier: 60 requests/minute, 50,000/month
  - Enterprise tier: 120 requests/minute, unlimited monthly
- **Added:** API versioning strategy documented in OpenAPI spec
  - Version prefix: `/api/v1/`
  - URL path versioning with semantic versioning
- **Added:** Unit tests for OpenAPI specification (39 tests)
  - Validates spec structure, paths, schemas, and parameters
  - Tests rate limit tiers and API version configuration
  - Verifies documentation completeness

## [2.0.5] - 2026-01-12

### Webhook Delivery Tracking (L3)
- **Added:** webhook_deliveries table for delivery attempt logging (T304)
  - Migration: `013_create_webhook_deliveries.sql`
  - Schema: id, webhook_id, event_type, payload, response_code, response_body, attempted_at
  - Foreign key to webhook_endpoints with CASCADE delete
  - No RLS (admin-only access via service role)
  - Indexes for webhook_id, attempted_at, and composite (webhook_id, attempted_at)
  - Truncates response body to 1024 characters for storage efficiency
- **Added:** Test file for webhook_deliveries verification (`013_test_webhook_deliveries.sql`)
- **Updated:** send-webhook Edge Function to log all delivery attempts
  - Logs successful deliveries with response code and body
  - Logs failed deliveries after all retries exhausted
  - Captures HTTP status code or error message

## [2.0.4] - 2026-01-12

### Bug Fixes
- **Fixed:** RLS policy violation when uploading releases via admin upload
  - Admin upload route now uses service role client to bypass RLS
  - Previously used anon key client which failed INSERT operations on `indicators` table
  - Error message was: "Failed to insert new indicators: new row violates row-level security policy for table "indicators""
- **Docs:** Expanded magic link redirect troubleshooting in DEPLOY.md
  - Added guidance for custom domains (e.g., `econwatch.live` vs Vercel preview URL)
  - Clarified that Supabase Site URL must match the desired production domain

## [2.0.3] - 2026-01-12

### Bug Fixes
- **Fixed:** send-webhook Edge Function fails to deliver webhooks
  - Changed webhook endpoint query to fetch all enabled endpoints and filter by event type in code
  - The Supabase JS `.contains()` array filter was not reliably returning results in the Edge Function environment
  - Added environment variable validation for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
  - Added debug logging to track webhook endpoint fetching and filtering
  - Webhooks now correctly match endpoints subscribed to `release.published` and `release.revised` events

## [2.0.2] - 2026-01-12

### Webhook Delivery (L3)
- **Added:** Webhook delivery Edge Function (`supabase/functions/send-webhook/index.ts`) (T303)
  - Triggered alongside email alerts when releases are published or revised
  - INSERT events trigger 'release.published' webhooks
  - UPDATE events with actual value changes trigger 'release.revised' webhooks
  - Signs payload with HMAC-SHA256 using endpoint secret
  - Headers for standard webhooks: X-Webhook-Signature, X-Webhook-Event, X-Webhook-Id, User-Agent
  - Retry logic with exponential backoff (3 attempts: 1s, 2s, 4s delays)
  - Discord webhook support with formatted embeds (content + embeds structure)
  - Updates `last_triggered_at` timestamp on successful delivery
  - Queries all enabled webhook endpoints subscribed to event type
- **Added:** Database webhook trigger migration (`012_create_webhook_delivery_trigger.sql`)
  - Documentation for Dashboard webhook configuration
  - Triggers on releases table INSERT and UPDATE events
  - Timeout: 30000ms to allow for retries

## [2.0.1] - 2026-01-12

### Bug Fixes
- **Fixed:** Discord webhook test failing with 400 Bad Request (T302)
  - Discord webhooks now receive properly formatted payloads with `content` and `embeds` fields
  - Added `isDiscordWebhook()` function to detect Discord webhook URLs (discord.com and discordapp.com)
  - Added `createDiscordTestPayload()` function to create Discord-compatible test messages
  - Discord test messages show as formatted embeds with indicator details
  - Non-Discord webhooks continue to use the standard payload format
  - Custom webhook headers (X-Webhook-Signature, X-Webhook-Event, User-Agent) omitted for Discord
  - Added 4 new unit tests for Discord webhook handling

## [2.0.0] - L2 Release - 2026-01-12

### Webhook Notifications (L3)
- **Added:** webhook_endpoints table migration (`011_create_webhook_endpoints.sql`) (T300)
  - Schema: id, user_id, url, secret, events, enabled, created_at, updated_at, last_triggered_at
  - Events stored as text array with default `{release.published}`
  - Supported event types: 'release.published', 'release.revised'
  - RLS policies: users can only CRUD their own webhook endpoints
  - Indexes for user_id, enabled webhooks, and events array (GIN)
  - Auto-update trigger for updated_at column
- **Added:** Test file for webhook_endpoints verification (`011_test_webhook_endpoints.sql`)
  - Verification queries for table structure, constraints, indexes, and RLS policies
  - Manual RLS test steps documented for user isolation verification
- **Added:** Webhook server actions (`src/app/actions/webhooks.ts`) (T301)
  - `listWebhooks()` - Fetch all webhook endpoints for the current user (secrets masked)
  - `createWebhook(input)` - Create webhook endpoint with URL validation and auto-generated secret
  - `updateWebhook(id, input)` - Update webhook URL, events, or enabled status
  - `deleteWebhook(id)` - Delete webhook endpoint permanently
  - `testWebhook(id)` - Send test payload with HMAC-SHA256 signature to verify endpoint
  - URL validation: HTTPS required, localhost blocked in production
  - Event types: 'release.published', 'release.revised'
  - Secret format: `whsec_{32 hex characters}` (38 chars total)
  - Comprehensive test coverage (35 tests)
- **Added:** Webhook management UI at `/settings/webhooks` (T302)
  - Route: `/settings/webhooks` with authentication guard
  - Component: `WebhooksClient.tsx`
  - Create webhook form with URL input and event type selection
  - Created secret shown only once (like API keys page) with copy button
  - List view showing URL, status (Active/Disabled), events, secret preview, timestamps
  - Edit mode for updating URL and event subscriptions
  - Enable/Disable toggle for each webhook endpoint
  - Delete with confirmation dialog
  - Test button sends sample payload and displays status code and response time
  - Usage documentation with signature verification instructions and sample payload

### Revision Tracking
- **Added:** RevisionBadge component to indicate revised releases on calendar (T232)
  - Component: `src/app/components/RevisionBadge.tsx`
  - Shows amber "Revised" badge next to indicator name when `revision_history` is non-empty
  - Hover tooltip displays latest revision details: previous value → new value, and revision date
  - Badge only appears for releases with at least one revision
  - Unit tests for `getLatestRevision` helper function (11 tests)
  - Integrated into main calendar page (`/`)

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