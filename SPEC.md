# Macro Calendar — Product Spec

## Goal
Launch a public macroeconomic release calendar with searchable historical releases.

## Non-goals (for L0)
- No paid data feeds
- No real-time "instant release alerts" yet
- No forecasting, signals, or commentary
- No complex user accounts (optional later)

## L0 User Stories
1. As a user, I can view a list of upcoming releases (next 7/30 days).
2. As a user, I can search/filter by country, category, and impact.
3. As a user, I can click an indicator to view a detail page with historical releases.
4. As an admin, I can upload a CSV to add/update releases.

## Data Model (L0)
### Table: indicators
- id (uuid, pk)
- name (text) e.g., "CPI (YoY)"
- country_code (text) e.g., "US"
- category (text) e.g., "Inflation"
- source_name (text) e.g., "BLS"
- source_url (text)
- created_at (timestamptz)

### Table: releases
- id (uuid, pk)
- indicator_id (uuid, fk -> indicators.id)
- release_at (timestamptz)  // scheduled time
- period (text)             // e.g. "Dec 2025"
- actual (text, nullable)
- forecast (text, nullable)
- previous (text, nullable)
- revised (text, nullable)
- unit (text, nullable)     // "%", "Index", etc.
- notes (text, nullable)
- created_at (timestamptz)

Indexes:
- releases(release_at)
- releases(indicator_id, release_at desc)
- indicators(country_code)
- indicators(category)

## Core Screens (L0)
1) "/" Calendar
- Default view: next 7 days
- Filters: country, category, impact (impact optional if present)
- Search bar: indicator name
- Each row: time (local), country, indicator name, period, forecast/previous, status (scheduled/released)

2) "/indicator/[id]"
- Indicator header (name, country, category, source)
- Historical releases table (most recent first)
- Basic pagination (later). For L0, limit 200 rows.

3) "/admin/upload"
- Simple form: CSV file upload
- Access control: requires header or query param secret (ADMIN_UPLOAD_SECRET)
- Behavior: upsert indicators + insert/update releases

## CSV Format (L0)
Columns (required):
- indicator_name
- country_code
- category
- source_name
- source_url
- release_at (ISO8601)
- period

Optional:
- actual, forecast, previous, revised, unit, notes

## Quality Bar
- Every feature must have:
  - acceptance criteria
  - manual test steps
- No silent refactors
- No new feature outside L0 without updating this spec

## Deployment
- Vercel for app hosting
- Supabase for DB
- Environment variables set in Vercel project settings
