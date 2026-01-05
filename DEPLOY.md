# Deployment Guide — Macro Calendar

This document provides step-by-step instructions for deploying the Macro Calendar application to Vercel with Supabase as the database backend.

## Prerequisites

- GitHub account with access to the repository
- Vercel account (free tier is sufficient for L1 traffic expectations)
- Supabase project (free tier is sufficient for L1 traffic expectations)
- Node.js 18+ installed locally (for local testing before deployment)

## 1. Supabase Setup

### 1.1 Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose an organization and provide:
   - **Project name**: `macro-calendar` (or your preferred name)
   - **Database password**: Generate a strong password and save it securely
   - **Region**: Choose closest to your target users
4. Wait for project initialization (1-2 minutes)

### 1.2 Run Database Migrations
1. In your Supabase project dashboard, navigate to **SQL Editor**
2. Execute the migration files in order:
   - Copy content from `supabase/migrations/001_create_tables.sql`
   - Click "Run" to create tables and indexes
   - (Optional) Run `supabase/migrations/001_test_seed.sql` for test data

### 1.3 Get API Credentials
1. In Supabase dashboard, go to **Settings** → **API**
2. Copy the following values (you'll need them for Vercel):
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 1.4 Verify Row Level Security (RLS)
RLS policies are included in the migration file (`001_create_tables.sql`) and are applied automatically.

To verify RLS is enabled:
1. In Supabase **Table Editor**, click on `indicators` table
2. Check that "RLS enabled" badge appears
3. Repeat for `releases` table

The policies configured:
- **Public read access**: Anonymous users can SELECT from `indicators` and `releases`
- **Write protection**: INSERT/UPDATE/DELETE blocked for anon key on public tables
- **Per-user data**: `profiles` and `watchlist` enforce owner-only access (users can only see and modify their own rows)

### 1.5 Configure Supabase Auth
1. In Supabase **Authentication** → **Providers**, enable **Email** (magic link).
2. In **Authentication** → **URL Configuration**, set **Site URL** to your Vercel domain and add a redirect for `/auth/callback`.
3. In **Authentication** → **Policies**, confirm the default RLS policies apply to `auth.users` and that `profiles`/`watchlist` tables have per-user policies (see migrations).

## 2. Vercel Deployment

### 2.1 Initial Deployment
1. Go to [https://vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New..."** → **"Project"**
3. Import your repository: `InsightsLog/Insights`
4. Configure project settings:
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `macro-calendar`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
5. Do NOT deploy yet — configure environment variables first

### 2.2 Configure Environment Variables
In the Vercel project settings, add these environment variables:

| Variable Name | Value | Where to Find |
|---------------|-------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | Supabase → Settings → API → anon/public key |

**Important notes:**
- Both variables are required for the app to run (validated by `src/lib/env.ts`)
- The `NEXT_PUBLIC_` prefix exposes these to the browser (safe for anon key)
- Environment variables are available to all environments (Production, Preview, Development) by default

### 2.3 Deploy
1. Click **"Deploy"**
2. Wait for build to complete (2-3 minutes)
3. Vercel will provide a production URL: `https://your-project.vercel.app`

### 2.4 Verify Deployment
1. Visit your production URL
2. Check that the calendar page loads without errors
3. Verify filters work (Country, Category dropdowns)
4. Test search functionality
5. Check browser console for any errors

## 3. Post-Deployment

### 3.1 Custom Domain (Optional)
1. In Vercel project settings, go to **Domains**
2. Add your custom domain (e.g., `macrocalendar.example.com`)
3. Follow DNS configuration instructions provided by Vercel
4. SSL certificate is automatically provisioned

### 3.2 Set Up Monitoring
Vercel provides built-in monitoring:
- **Analytics**: Vercel → Project → Analytics (tracks page views, performance)
- **Logs**: Vercel → Project → Deployments → [deployment] → Functions (server logs)
- **Error tracking**: Check Vercel logs for runtime errors

For production, consider adding:
- **Sentry** for error tracking (optional but recommended)
- **Supabase monitoring**: Check Dashboard → Reports for query performance

### 3.3 Enable Branch Previews
By default, Vercel creates preview deployments for all branches:
1. Each PR automatically gets a unique preview URL
2. Preview deployments use the same environment variables as production
3. Test changes in preview before merging to main

## 4. Security Best Practices

### 4.1 Supabase Key Rotation
To rotate your Supabase anon key:
1. In Supabase dashboard, go to **Settings** → **API**
2. **Warning**: Supabase does not support rotating the anon key without recreating the project
3. The anon key is safe to expose for public tables; RLS prevents writes and hides per-user data.
4. Use the service role key for server-side operations only (never expose it with `NEXT_PUBLIC_`).

### 4.2 Database Credentials
- **Never commit** database passwords or service role keys to git
- Store sensitive credentials only in Vercel environment variables
- Use separate Supabase projects for production and staging

### 4.3 Admin Upload Secret (interim)
While admin access uses a shared secret (until role-based auth lands in L2):
1. Generate a secure random string: `openssl rand -hex 32`
2. Add to Vercel environment variables as `ADMIN_UPLOAD_SECRET`
3. Rotate monthly and update Vercel settings

## 5. Rollback Procedure

If a deployment causes issues:
1. In Vercel dashboard, go to **Deployments**
2. Find the last working deployment
3. Click **"..."** → **"Promote to Production"**
4. Previous deployment is instantly restored

## 6. Local Development Sync

To ensure local environment matches production:
1. Copy `.env.example` to `.env.local`:
```bash
cd macro-calendar
cp .env.example .env.local
```
2. Add the same Supabase credentials used in Vercel
3. Run `npm run dev` to verify configuration
4. Environment validation (`src/lib/env.ts`) will fail fast if variables are missing

## 7. Troubleshooting

### Build Fails with "Environment variable missing"
- Check that all required variables are set in Vercel: **Settings** → **Environment Variables**
- Verify variable names match exactly (case-sensitive)
- Redeploy after adding variables

### Database Connection Errors
- Verify Supabase project is active (not paused)
- Check that RLS policies are configured correctly
- Confirm `NEXT_PUBLIC_SUPABASE_URL` and anon key are correct

### Blank Calendar Page
- Check Vercel function logs for errors
- Verify database has data: run test seed `supabase/migrations/001_test_seed.sql`
- Ensure indexes are created: `supabase/migrations/001_create_tables.sql`

### Search/Filter Not Working
- Check browser console for JavaScript errors
- Verify Next.js is using the correct build output
- Clear Vercel build cache: **Settings** → **General** → **Clear Build Cache**

## 8. Maintenance

### Regular Tasks
- **Weekly**: Check Vercel analytics for traffic patterns and errors
- **Monthly**: Review Supabase query performance (Dashboard → Reports)
- **Quarterly**: Update dependencies (`npm outdated` in `macro-calendar/`)

### Scaling Considerations (Post-L1)
- Supabase free tier: 500MB database, 50MB file storage, 50,000 monthly active users
- Vercel free tier: 100GB bandwidth, unlimited requests
- For growth beyond free tier, upgrade plans in Supabase/Vercel dashboards

---

## Quick Reference

**Vercel Dashboard**: [https://vercel.com/dashboard](https://vercel.com/dashboard)  
**Supabase Dashboard**: [https://app.supabase.com](https://app.supabase.com)  
**Production URL**: Check Vercel project settings  
**Support**: GitHub Issues in `InsightsLog/Insights` repository

---

**Last Updated**: January 2026  
**Version**: L1 (Auth + watchlists)
