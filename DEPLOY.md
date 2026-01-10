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
2. Execute the migration files **in order** (each migration builds on the previous):
   - `supabase/migrations/001_create_tables.sql` — Creates `indicators` and `releases` tables with RLS
   - `supabase/migrations/002_create_profiles.sql` — Creates `profiles` table for user accounts
   - `supabase/migrations/003_create_watchlist.sql` — Creates `watchlist` table for saved indicators
   - (Optional) `supabase/migrations/001_test_seed.sql` — Adds sample indicator/release data
3. For each migration file: copy the SQL content, paste into SQL Editor, and click "Run"
4. **Important**: All migrations must be run for full functionality. Missing migrations will cause runtime errors.

### 1.3 Get API Credentials
1. In Supabase dashboard, go to **Settings** → **API**
2. Copy the following values (you'll need them for Vercel):
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 1.4 Verify Row Level Security (RLS)
RLS policies are included in each migration file and are applied automatically.

To verify RLS is enabled:
1. In Supabase **Table Editor**, check that "RLS enabled" badge appears for all tables:
   - `indicators` (from 001_create_tables.sql)
   - `releases` (from 001_create_tables.sql)
   - `profiles` (from 002_create_profiles.sql)
   - `watchlist` (from 003_create_watchlist.sql)

The policies configured:
- **Public read access**: Anonymous users can SELECT from `indicators` and `releases`
- **Write protection**: INSERT/UPDATE/DELETE blocked for anon key on public tables
- **Per-user data**: `profiles` and `watchlist` enforce owner-only access (users can only see and modify their own rows)

### 1.5 Configure Supabase Auth
1. In Supabase **Authentication** → **Providers**, enable **Email** (magic link).
2. In **Authentication** → **URL Configuration**:
   - **Site URL**: Set to your production Vercel domain (e.g., `https://your-project.vercel.app`)
   - **Redirect URLs**: Add `https://your-project.vercel.app/auth/callback`
   - ⚠️ **Critical**: If Site URL is left as `http://localhost:3000`, magic links will redirect to localhost instead of your production site. This is a common cause of "can't reach page" errors after clicking magic links.
3. In **Authentication** → **Policies**, confirm the default RLS policies apply to `auth.users` and that `profiles`/`watchlist` tables have per-user policies (see migrations).

## 2. Vercel Deployment

### 2.1 Initial Deployment
1. Go to [https://vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New..."** → **"Project"**
3. Import your repository: `InsightsLog/Insights`
4. Configure project settings:
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `macro-calendar` ← **Required for monorepo**
   - **Build Command**: `npm run build` (default) – do NOT use `cd macro-calendar &&` prefix
   - **Install Command**: `npm install` (default) – do NOT use `cd macro-calendar &&` prefix
   - **Output Directory**: Leave empty (Vercel handles this automatically for Next.js SSR)
   - **Node.js Version**: 24.x (default)
   - **Note**: When Root Directory is set, Vercel automatically changes to that folder BEFORE running commands. Do NOT prefix commands with `cd macro-calendar &&` as this will fail.
5. Do NOT deploy yet — configure environment variables first

### 2.2 Correct Project Settings Summary
The Vercel project must have these settings:

| Setting | Value | Notes |
|---------|-------|-------|
| **Root Directory** | `macro-calendar` | Required – Vercel changes to this folder before build |
| **Framework Preset** | Next.js | Auto-detected |
| **Build Command** | `npm run build` | Default – NO `cd` prefix needed |
| **Install Command** | `npm install` | Default – NO `cd` prefix needed |
| **Output Directory** | (empty) | Let Vercel auto-detect for Next.js SSR |
| **Node.js Version** | 24.x | Current default |

**Important**: The `vercel.json` file in the repo should NOT contain `installCommand` or `buildCommand` with `cd macro-calendar &&` prefixes. These conflict with the Root Directory setting and cause build failures.

### 2.3 Configure Environment Variables
In the Vercel project settings, add these environment variables:

| Variable Name | Value | Where to Find |
|---------------|-------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | Supabase → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key | Supabase → Settings → API → service_role key (secret) |
| `UNSUBSCRIBE_TOKEN_SECRET` | Random secret for unsubscribe tokens | Generate with: `openssl rand -hex 32` |

**Important notes:**
- Both `NEXT_PUBLIC_` variables are required for the app to run (validated by `src/lib/env.ts`)
- The `NEXT_PUBLIC_` prefix exposes these to the browser (safe for anon key)
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and used for operations that bypass RLS (e.g., unsubscribe)
- `UNSUBSCRIBE_TOKEN_SECRET` is server-only and used to sign email unsubscribe tokens
- Environment variables are available to all environments (Production, Preview, Development) by default

### 2.4 Deploy
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

### 4.3 Admin Upload Secret & Unsubscribe Token Secret
Two server-side secrets are required:

1. **ADMIN_UPLOAD_SECRET** (interim until role-based auth in L2):
   - Generate: `openssl rand -hex 32`
   - Add to Vercel environment variables
   - Rotate monthly and update Vercel settings

2. **UNSUBSCRIBE_TOKEN_SECRET** (for email alert unsubscribe links):
   - Generate: `openssl rand -hex 32`
   - Add to Vercel environment variables
   - Also add to Supabase Edge Function secrets (see Section 8.2)
   - Used to sign HMAC tokens for one-click unsubscribe

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

### Build Fails with "cd: macro-calendar: No such file or directory"
This error occurs when:
- The `vercel.json` file has `installCommand` or `buildCommand` with `cd macro-calendar &&` prefix
- AND the Vercel project Root Directory is set to `macro-calendar`

When Root Directory is set, Vercel automatically changes to that folder BEFORE running commands. The `cd macro-calendar` then fails because there's no nested `macro-calendar` folder.

**To fix:**
1. Remove `installCommand` and `buildCommand` from `vercel.json`, OR
2. Remove the Root Directory setting (not recommended for this monorepo)

The correct `vercel.json` should be minimal:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json"
}
```

### Build Fails with "Environment variable missing"
- Check that all required variables are set in Vercel: **Settings** → **Environment Variables**
- Verify variable names match exactly (case-sensitive)
- Redeploy after adding variables

### Database Connection Errors
- Verify Supabase project is active (not paused)
- Check that RLS policies are configured correctly
- Confirm `NEXT_PUBLIC_SUPABASE_URL` and anon key are correct

### 404 Error After Deployment
This typically indicates incorrect Output Directory settings in Vercel:

**To fix:**
1. Go to your Vercel project → **Settings** → **General**
2. Scroll to **Build & Development Settings**
3. Verify these settings:
   - **Root Directory**: `macro-calendar`
   - **Output Directory**: Leave empty or `.next` (for Next.js SSR apps, Vercel handles this automatically)
4. **Important**: If Output Directory shows `/macro-calendar/.next` (with leading `/`), clear it completely
5. Click **Save** and redeploy

**Why this happens**: For Next.js SSR apps, Vercel's built-in builder handles output directories automatically. Setting a custom `outputDirectory` (especially with an absolute path like `/macro-calendar/.next`) breaks serverless function routing, causing 404 errors on all routes.

### Blank Calendar Page
- Check Vercel function logs for errors
- Verify database has data: run test seed `supabase/migrations/001_test_seed.sql`
- Ensure indexes are created: `supabase/migrations/001_create_tables.sql`

### Search/Filter Not Working
- Check browser console for JavaScript errors
- Verify Next.js is using the correct build output
- Clear Vercel build cache: **Settings** → **General** → **Clear Build Cache**

### Magic Link Redirects to localhost:3000
When clicking a magic link from the sign-in email, you're redirected to `http://localhost:3000/?code=XX` instead of your production URL.

**Root cause**: The **Site URL** in Supabase Authentication settings is set to `http://localhost:3000` instead of your production Vercel URL.

**To fix:**
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Update **Site URL** to your production URL (e.g., `https://your-project.vercel.app`)
4. Ensure **Redirect URLs** includes `https://your-project.vercel.app/auth/callback`
5. Click **Save**

**Why this happens**: Supabase Auth uses the Site URL to construct the base URL for magic links. Even though the app passes `emailRedirectTo` with the correct production URL, Supabase validates and constructs the final redirect URL based on the Site URL configuration. If it's set to localhost, the magic link will redirect to localhost.

**Note**: No code changes or redeployment are needed — this is purely a Supabase dashboard configuration issue.

### "Unable to load watchlist data" Error
After signing in, the calendar page shows "Unable to load watchlist data. Please check your connection and try again." when the watchlist toggle is enabled.

**Root cause**: The `watchlist` table does not exist in the database. The migration `003_create_watchlist.sql` was not applied.

**To fix:**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/003_create_watchlist.sql`
4. Paste into the SQL Editor and click **Run**
5. Verify the `watchlist` table appears in the **Table Editor** with "RLS enabled" badge

**Why this happens**: Each migration file creates specific tables. If any migration is skipped or missed, features depending on that table will fail. The watchlist feature (T120-T130) requires the `watchlist` table from migration 003.

## 8. Email Alerts (L2)

Email alerts require Supabase Edge Functions and a Resend account for sending emails.

### 8.1 Resend Setup

1. Create a [Resend](https://resend.com) account
2. [Verify your domain](https://resend.com/domains) for sending emails
3. [Create an API key](https://resend.com/api-keys) and save it securely

### 8.2 Deploy Edge Function

The email alert system uses a Supabase Edge Function triggered by database webhooks.

1. Install the [Supabase CLI](/docs/guides/cli#installation) if not already installed
2. Link your project:
   ```bash
   cd macro-calendar
   supabase link --project-ref <your-project-ref>
   ```
3. Set the required secrets:
   ```bash
   supabase secrets set RESEND_API_KEY=<your-resend-api-key>
   supabase secrets set EMAIL_FROM=alerts@yourdomain.com
   supabase secrets set APP_URL=https://your-app.vercel.app
   supabase secrets set UNSUBSCRIBE_TOKEN_SECRET=<your-random-secret>
   ```
   Generate a secure random secret for UNSUBSCRIBE_TOKEN_SECRET:
   ```bash
   openssl rand -hex 32
   ```
4. Deploy the Edge Function:
   ```bash
   supabase functions deploy send-release-alert --no-verify-jwt
   ```

### 8.3 Configure Database Webhook

1. In Supabase Dashboard, go to **Database** → **Webhooks**
2. Click **Create a new webhook**
3. Configure the webhook:
   - **Name**: `send-release-alert`
   - **Table**: `public.releases`
   - **Events**: Check `INSERT`
   - **Type**: `Supabase Edge Functions`
   - **Edge Function**: Select `send-release-alert`
   - **Method**: `POST`
   - **Timeout**: `5000` (5 seconds for email delivery)
4. Add HTTP Headers:
   - Click "Add new header"
   - Add `Content-Type`: `application/json`
   - Click "Add auth header with service key"
5. Click **Create webhook**

### 8.4 Verify Setup

1. Enable email alerts for an indicator in the watchlist
2. Insert a test release row in the `releases` table
3. Check Edge Function logs in **Functions** → **send-release-alert** → **Logs**
4. Verify the email was received

### 8.5 Troubleshooting Email Alerts

**No emails sent**
- Verify RESEND_API_KEY is set correctly: `supabase secrets list`
- Check Edge Function logs for errors
- Ensure users have email alerts enabled (`email_enabled = true` in `alert_preferences`)

**Webhook not triggering**
- Verify the webhook is enabled in Database → Webhooks
- Check the webhook targets the correct table and event
- Review webhook logs in the Supabase Dashboard

**Email delivery issues**
- Verify your domain is verified in Resend
- Check that EMAIL_FROM matches your verified domain
- Review Resend dashboard for delivery status

## 9. Maintenance

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
**Version**: L2 (Alerts + Admin)
