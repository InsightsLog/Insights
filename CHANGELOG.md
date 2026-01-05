# Changelog

## Unreleased
- Initial scaffolding
- Created Supabase database schema (indicators and releases tables with indexes)
- Added environment variable validation with zod (src/lib/env.ts)
- Added Supabase client wrappers for server and client components
- **Fixed:** Environment validation now runs at startup via next.config.ts import (fail-fast on missing env vars)
