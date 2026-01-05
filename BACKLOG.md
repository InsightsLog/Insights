# Backlog

Items that were identified during development but deferred for future work.

## Performance

_No items yet._

## Security

_No items yet._

## UX

_No items yet._

## L2+ Ideas

- **Build-time env validation for browser client (T011):** The browser Supabase client (`supabase-browser.ts`) uses non-null assertions for `NEXT_PUBLIC_*` env vars since they're inlined at build time. If a production build runs without these vars set, the client receives empty strings rather than failing at build time. Runtime checks catch this, but a build-time validation (e.g., via Next.js config or custom webpack plugin) would provide earlier feedback.
