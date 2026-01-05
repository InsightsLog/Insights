# Changelog

## Unreleased
- Initial scaffolding
- Created Supabase database schema (indicators and releases tables with indexes)
- Added environment variable validation with zod (src/lib/env.ts)
- Added Supabase client wrappers for server and client components
- **Fixed:** Environment validation now runs at startup via next.config.ts import (fail-fast on missing env vars)
- Added calendar page "/" with table layout showing placeholder release data (T020)
- Calendar page now queries real releases from Supabase (next 7 days, joined with indicators, ordered by release_at) (T021)
- Calendar table now shows separate columns: Actual, Forecast, Previous, Revised (T024)
  - Actual values display in green bold when released
  - Revised column visible for all rows (shows "—" when no data)
- **Verified:** `revised` column correctly included in Supabase query; added test seed data with revised value (T025)
- Added filter dropdowns for Country and Category on calendar page (T022)
  - Filters use URL search params for bookmarkable/shareable state
  - Clear filters button appears when any filter is active
- Added search input for indicator name on calendar page (T023)
  - Search is case-insensitive and matches partial indicator names
  - Search uses URL search params and debounces input (300ms)
  - Can be combined with country and category filters
- Updated app metadata: browser title now shows "Macro Calendar" instead of placeholder (T060)
- Expanded root README with project overview, structure, quick start guide, and features list (T060)
- **Improved:** Added graceful error handling for database failures (T061)
  - Supabase query errors now return error states instead of silent empty arrays
  - User sees clear error message "Unable to load calendar data" when DB connection fails
  - Error message displayed in red alert banner instead of blank table
