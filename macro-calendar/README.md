# Macro Calendar (app)

This is the Next.js app for the Insights Macro Calendar. For product scope and tasks, see the root docs:
- [README.md](../README.md) — overview and setup
- [SPEC.md](../SPEC.md) — L1 requirements (auth + watchlists)
- [TASKS_L1.md](../TASKS_L1.md) — active work

## Quick start
1. `cd macro-calendar && npm install`
2. Copy `.env.example` to `.env.local` and fill Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_UPLOAD_SECRET`).
3. `npm run dev` then open http://localhost:3000.

Deployment steps live in [DEPLOY.md](../DEPLOY.md).
