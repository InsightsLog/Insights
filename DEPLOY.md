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
   - `supabase/migrations/004_create_alert_preferences.sql` — Creates `alert_preferences` table for email alerts
   - `supabase/migrations/005_create_release_alert_webhook.sql` — Enables pg_net extension for webhooks
   - `supabase/migrations/006_create_user_roles.sql` — Creates `user_roles` table for admin access
   - `supabase/migrations/007_create_audit_log.sql` — Creates `audit_log` table for admin action tracking
   - `supabase/migrations/008_create_api_keys.sql` — Creates `api_keys` table for API authentication
   - `supabase/migrations/009_create_request_logs.sql` — Creates `request_logs` table for abuse detection
   - `supabase/migrations/010_add_revision_history.sql` — Adds revision_history column to releases
   - `supabase/migrations/011_create_webhook_endpoints.sql` — Creates `webhook_endpoints` table for webhooks
   - `supabase/migrations/012_create_webhook_delivery_trigger.sql` — Documents webhook delivery trigger setup
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
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST API URL (optional) | Upstash Console → Redis Database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API token (optional) | Upstash Console → Redis Database → REST API |
| `ENABLE_REQUEST_LOGGING` | Enable request logging (optional) | Set to `true` to enable, leave unset or `false` to disable |
| `STRIPE_SECRET_KEY` | Stripe API secret key (optional) | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (optional) | Stripe Dashboard → Webhooks → Endpoint → Signing secret |
| `STRIPE_PRICE_PLUS_MONTHLY` | Stripe price ID for Plus monthly (optional) | Stripe Dashboard → Products → Plus → Price ID |
| `STRIPE_PRICE_PLUS_YEARLY` | Stripe price ID for Plus yearly (optional) | Stripe Dashboard → Products → Plus → Price ID |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe price ID for Pro monthly (optional) | Stripe Dashboard → Products → Pro → Price ID |
| `STRIPE_PRICE_PRO_YEARLY` | Stripe price ID for Pro yearly (optional) | Stripe Dashboard → Products → Pro → Price ID |
| `STRIPE_PRICE_ENTERPRISE_MONTHLY` | Stripe price ID for Enterprise monthly (optional) | Stripe Dashboard → Products → Enterprise → Price ID |
| `STRIPE_PRICE_ENTERPRISE_YEARLY` | Stripe price ID for Enterprise yearly (optional) | Stripe Dashboard → Products → Enterprise → Price ID |
| `FRED_API_KEY` | FRED API key for economic data (optional) | Get free at [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) |
| `FMP_API_KEY` | Financial Modeling Prep API key (optional) | Get free at [financialmodelingprep.com](https://financialmodelingprep.com/register) |
| `FINNHUB_API_KEY` | Finnhub API key (optional) | Get free at [finnhub.io](https://finnhub.io/register) |
| `TRADING_ECONOMICS_API_KEY` | Trading Economics API key (optional) | Register at [tradingeconomics.com](https://tradingeconomics.com/api) |
| `CRON_SECRET` | Secret for Vercel Cron authentication | Generate with: `openssl rand -hex 32` |

**Important notes:**
- Both `NEXT_PUBLIC_` variables are required for the app to run (validated by `src/lib/env.ts`)
- The `NEXT_PUBLIC_` prefix exposes these to the browser (safe for anon key)
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and used for operations that bypass RLS (e.g., unsubscribe, request logging)
- `UNSUBSCRIBE_TOKEN_SECRET` is server-only and used to sign email unsubscribe tokens
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are optional; rate limiting is disabled if not set
- `ENABLE_REQUEST_LOGGING` is optional; request logging is disabled by default (requires `SUPABASE_SERVICE_ROLE_KEY`)
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are required for billing/subscription features
- `STRIPE_PRICE_*` variables are required for plan upgrades; get price IDs from Stripe Products dashboard
- `FRED_API_KEY` is optional; enables importing real economic data from Federal Reserve (see Section 12)
- `FMP_API_KEY`, `FINNHUB_API_KEY`, `TRADING_ECONOMICS_API_KEY` are optional; at least one is required for importing upcoming scheduled releases (see Section 15)
- `CRON_SECRET` is required for automated data sync; protects the cron endpoint from unauthorized access
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

### Magic Link Redirects to localhost:3000 or Wrong Domain
When clicking a magic link from the sign-in email, you're redirected to `http://localhost:3000/?code=XX` or a Vercel preview URL (e.g., `https://project-xxx.vercel.app`) instead of your production custom domain.

**Root cause**: The **Site URL** in Supabase Authentication settings is not set to your production custom domain.

**To fix:**
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Update **Site URL** to your production custom domain (e.g., `https://econwatch.live` or `https://your-project.vercel.app`)
4. Ensure **Redirect URLs** includes your custom domain callback URL (e.g., `https://econwatch.live/auth/callback`)
5. Click **Save**

**Why this happens**: Supabase Auth uses the Site URL to construct the base URL for magic links. Even though the app passes `emailRedirectTo` with the correct production URL, Supabase validates and constructs the final redirect URL based on the Site URL configuration. If it's set to localhost or a Vercel preview URL, the magic link will redirect there instead of your custom domain.

**Common scenarios**:
- Site URL set to `http://localhost:3000` → magic links redirect to localhost
- Site URL set to Vercel preview URL (e.g., `https://insights-tawny.vercel.app`) → magic links redirect to that URL instead of custom domain (`econwatch.live`)
- After adding a custom domain, always update Site URL in Supabase to match

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

## 9. Webhook Delivery (L3)

User-configured webhooks are delivered via the `send-webhook` Edge Function when releases are published or revised.

### 9.1 Deploy Edge Function

1. Deploy the webhook delivery Edge Function:
   ```bash
   supabase functions deploy send-webhook --no-verify-jwt
   ```

### 9.2 Configure Database Webhook

1. In Supabase Dashboard, go to **Database** → **Webhooks**
2. Click **Create a new webhook**
3. Configure the webhook:
   - **Name**: `send-webhook`
   - **Table**: `public.releases`
   - **Events**: Check `INSERT` and `UPDATE`
   - **Type**: `Supabase Edge Functions`
   - **Edge Function**: Select `send-webhook`
   - **Method**: `POST`
   - **Timeout**: `30000` (30 seconds for retries)
4. Add HTTP Headers:
   - Click "Add new header"
   - Add `Content-Type`: `application/json`
   - Click "Add auth header with service key"
5. Click **Create webhook**

### 9.3 Event Types

The Edge Function handles these event types:
- **release.published**: Triggered on INSERT (new release)
- **release.revised**: Triggered on UPDATE when `actual` value changes

### 9.4 Webhook Delivery Details

- Payloads are signed with HMAC-SHA256 using the endpoint's secret
- Headers for standard webhooks: `X-Webhook-Signature`, `X-Webhook-Event`, `X-Webhook-Id`, `User-Agent`
- Discord webhooks receive formatted embeds (no signature headers)
- Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s delays)
- `last_triggered_at` is updated on successful delivery

### 9.5 Troubleshooting Webhooks

**Webhooks not delivered**
- Check Edge Function logs in **Functions** → **send-webhook** → **Logs**
- Verify the user has webhook endpoints enabled
- Ensure the endpoint URL is reachable from Supabase

**Webhook verification failing**
- Verify signature is computed correctly: `sha256=<hex_hmac_sha256(payload, secret)>`
- Check that `X-Webhook-Signature` header is present
- Ensure the payload hasn't been modified

**Retries exhausted**
- Check the endpoint URL is valid and returns 2xx for successful delivery
- 4xx errors (except 429) are not retried
- Network errors and 5xx errors trigger retries

## 10. Rate Limiting (L2)

Rate limiting protects the API from abuse and ensures fair usage. It uses Upstash Redis for distributed rate limiting.

### 10.1 Upstash Redis Setup

1. Create an [Upstash](https://upstash.com) account
2. Create a new Redis database:
   - Go to **Console** → **Create Database**
   - Choose a region close to your Vercel deployment
   - Select the free tier (10,000 commands/day)
3. Copy the REST API credentials:
   - **UPSTASH_REDIS_REST_URL**: The REST API endpoint (e.g., `https://xxx.upstash.io`)
   - **UPSTASH_REDIS_REST_TOKEN**: The REST API token

### 10.2 Configure Environment Variables

Add the Upstash Redis credentials to Vercel:

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add the following variables:
   - `UPSTASH_REDIS_REST_URL`: Your Upstash REST API URL
   - `UPSTASH_REDIS_REST_TOKEN`: Your Upstash REST API token
3. Redeploy the application

### 10.3 Rate Limits

The following rate limits are enforced:

| Route Type | Limit | Routes |
|------------|-------|--------|
| Public | 60 requests/minute | All routes except below |
| Strict | 30 requests/minute | `/watchlist`, `/api/admin` |

When a rate limit is exceeded:
- HTTP 429 (Too Many Requests) is returned
- `Retry-After` header indicates seconds until limit resets
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers are included

### 10.4 Graceful Degradation

Rate limiting is **optional**. If the Upstash environment variables are not set:
- The application continues to work normally
- No rate limiting is applied
- This is useful for local development or if Redis is unavailable

### 10.5 Monitoring

Monitor rate limiting in the Upstash Console:
- **Usage**: View request counts and rate limit hits
- **Analytics**: Track patterns and identify potential abuse
- **Alerts**: Set up notifications for unusual activity

## 11. Maintenance

### Regular Tasks
- **Weekly**: Check Vercel analytics for traffic patterns and errors
- **Monthly**: Review Supabase query performance (Dashboard → Reports)
- **Quarterly**: Update dependencies (`npm outdated` in `macro-calendar/`)

### Scaling Considerations (Post-L1)
- Supabase free tier: 500MB database, 50MB file storage, 50,000 monthly active users
- Vercel free tier: 100GB bandwidth, unlimited requests
- For growth beyond free tier, upgrade plans in Supabase/Vercel dashboards

## 12. Importing Real Economic Data (FRED)

By default, the application uses test seed data. To display real economic data from the Federal Reserve Economic Data (FRED) API:

### 12.1 Get a FRED API Key

1. Go to [https://fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html)
2. Sign up for a free account (or sign in if you already have one)
3. Request an API key (free, instant approval)
4. Save your API key securely

### 12.2 Configure the Environment Variable

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add `FRED_API_KEY` with your API key value
3. Redeploy the application (or it will take effect on next deployment)

### 12.3 Trigger the Data Import

After configuring the API key and redeploying:

1. Sign in to the application with an admin account
2. Navigate to `/admin` (Admin Dashboard)
3. Find the "FRED Data Import" section
4. Click "Import FRED Data" to start the import
5. Wait for the import to complete (typically 2-5 minutes for all 16 indicators)

**What gets imported:**
- Real GDP and GDP Growth Rate
- Consumer Price Index (CPI) and Core CPI
- Producer Price Index (PPI)
- Unemployment Rate
- Non-Farm Payrolls
- Initial Jobless Claims
- Federal Funds Rate
- 2-Year and 10-Year Treasury Rates
- Consumer Sentiment Index
- Retail Sales
- Housing Starts and Building Permits
- Industrial Production Index

### 12.4 Alternative: CLI Import

For local development or advanced use cases, you can also run the import via CLI:

```bash
cd macro-calendar
FRED_API_KEY=your_api_key npx tsx src/lib/data-import/fred-import.ts
```

Optional environment variables for CLI:
- `FRED_IMPORT_START_DATE`: Start date (default: 2014-01-01, 10+ years of data)
- `FRED_IMPORT_SERIES`: Comma-separated list of specific series (default: all)

### 12.5 Troubleshooting FRED Import

**"FRED API key not configured" error**
- Verify `FRED_API_KEY` is set in Vercel environment variables
- Redeploy after adding the environment variable

**Import fails with API errors**
- FRED has a rate limit of 120 requests/minute; the import handles this automatically
- If errors persist, try importing fewer series at a time

**Data not appearing after import**
- Refresh the calendar page
- Check that the import completed successfully in the admin dashboard
- Verify the indicators exist in the database

### 12.6 Clearing Historical/Seed Data

To clear existing data before importing fresh data:

**Via Admin Dashboard**:
1. Navigate to `/admin` (requires admin role)
2. Find the "Clear Data" section
3. Choose what to clear:
   - **Clear Seed Data**: Removes test indicators from initial setup
   - **Clear FRED Data**: Removes all FRED-imported indicators
   - **Clear Both**: Removes seed and FRED data
   - **Clear ALL Data**: Removes everything (use with caution!)

**Via SQL (Supabase)**:
```sql
-- Clear seed data only
DELETE FROM releases WHERE indicator_id IN (
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002'
);
DELETE FROM indicators WHERE id IN (
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002'
);

-- Clear FRED data only
DELETE FROM releases WHERE indicator_id IN (
    SELECT id FROM indicators WHERE source_name ILIKE '%FRED%'
);
DELETE FROM indicators WHERE source_name ILIKE '%FRED%';

-- Clear ALL data (dangerous!)
DELETE FROM releases;
DELETE FROM indicators;
```

---

## 13. Calendar Integrations (L3)

The Macro Calendar supports exporting watchlist events to external calendars, allowing users to track economic releases in their preferred calendar application.

### 13.1 iCal/ICS Feed

Users can export their watchlist releases as an iCal file:

1. Sign in to the application
2. Add indicators to your watchlist
3. Navigate to `/watchlist`
4. Click the "Export to iCal" button in the header
5. Import the downloaded `.ics` file into your calendar application (Google Calendar, Apple Calendar, Outlook, etc.)

**iCal features:**
- RFC 5545 compliant format
- Events include indicator name, country, period, and forecast/previous values
- 30-minute event duration for economic releases
- Maximum 500 releases per export

### 13.2 Google Calendar One-Click Add

For individual events, users can add directly to Google Calendar:

1. View your watchlist at `/watchlist`
2. Each release row has a Google Calendar icon link
3. Click the icon to open Google Calendar with the event pre-filled
4. Confirm and save the event

### 13.3 Programmatic iCal Access

The iCal feed is also available via API for authenticated users:

**Endpoint:** `GET /api/calendar/ical`

**Authentication:** Requires active session cookie (magic link login)

**Response:**
- **Content-Type:** `text/calendar`
- **Body:** iCalendar (ICS) format file containing upcoming watchlist releases

**Example using cURL:**
```bash
curl -X GET "https://your-app.vercel.app/api/calendar/ical" \
  -H "Cookie: sb-access-token=your-auth-token"
```

**Response Codes:**
- `200 OK`: Returns iCal data
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Failed to fetch watchlist data

**Notes:**
- Only includes releases for indicators in the user's personal watchlist
- Maximum 500 upcoming releases included
- Event duration is 30 minutes per economic release

---

## 14. Data Coverage

### 14.1 G20 Country Coverage

The Macro Calendar provides comprehensive coverage of all G20 member economies:

| Country | Code | Data Sources |
|---------|------|--------------|
| Argentina | AR | IMF, World Bank |
| Australia | AU | IMF, World Bank |
| Brazil | BR | IMF, World Bank |
| Canada | CA | IMF, World Bank |
| China | CN | IMF, World Bank |
| France | FR | IMF, World Bank, ECB |
| Germany | DE | IMF, World Bank, ECB |
| India | IN | IMF, World Bank |
| Indonesia | ID | IMF, World Bank |
| Italy | IT | IMF, World Bank, ECB |
| Japan | JP | IMF, World Bank |
| Mexico | MX | IMF, World Bank |
| Russia | RU | IMF, World Bank |
| Saudi Arabia | SA | IMF, World Bank |
| South Africa | ZA | IMF, World Bank |
| South Korea | KR | IMF, World Bank |
| Turkey | TR | IMF, World Bank |
| United Kingdom | GB | IMF, World Bank |
| United States | US | FRED, BLS, IMF, World Bank |
| European Union | EU | ECB |

### 14.2 Additional Countries

Beyond G20, the platform covers additional economies including:
- **Eurozone**: Austria, Belgium, Greece, Ireland, Netherlands, Portugal, Spain
- **Asia-Pacific**: Hong Kong, Malaysia, New Zealand, Singapore, Thailand
- **Latin America**: Chile, Colombia
- **Others**: Israel, Norway, Poland, Sweden, Switzerland, UAE

### 14.3 Available Data Sources

| Source | Coverage | API Key Required | Notes |
|--------|----------|------------------|-------|
| FRED | US (800K+ series) | Required (free tier) | Most comprehensive US data |
| BLS | US (employment, prices) | Optional (free tier) | Higher limits with key |
| ECB | Eurozone | No | Interest rates, inflation, GDP |
| IMF | Global (37 countries) | No | World Economic Outlook data |
| World Bank | Global (38 countries) | No | Development indicators |

---

## 15. Scheduled Releases (Upcoming Events)

The calendar displays upcoming economic releases from multiple data sources. This section explains how to configure and populate the calendar with real scheduled releases.

### 15.1 Overview

Scheduled releases (future economic events) come from external calendar APIs:
- **Financial Modeling Prep (FMP)**: G20+ global coverage, 250 calls/day (free tier)
- **Finnhub**: Global economic calendar, 60 calls/minute (free tier)  
- **Trading Economics**: Comprehensive G20+ data, registration required

At least **one API key** is required to import upcoming events.

### 15.2 Get API Keys

1. **FMP (Recommended for free tier)**:
   - Go to [financialmodelingprep.com/register](https://financialmodelingprep.com/register)
   - Create a free account
   - Copy your API key from the dashboard

2. **Finnhub**:
   - Go to [finnhub.io/register](https://finnhub.io/register)
   - Create a free account
   - Copy your API key from the dashboard

3. **Trading Economics**:
   - Go to [tradingeconomics.com/api](https://tradingeconomics.com/api)
   - Request API access (registration required)
   - Copy your API key when approved

### 15.3 Configure Environment Variables

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add at least one of these:
   - `FMP_API_KEY` — Your Financial Modeling Prep API key
   - `FINNHUB_API_KEY` — Your Finnhub API key
   - `TRADING_ECONOMICS_API_KEY` — Your Trading Economics API key
3. Add the cron secret for automated sync:
   - `CRON_SECRET` — Generate with `openssl rand -hex 32`
4. Click **Redeploy** to apply changes

### 15.4 Import Upcoming Events

#### Option A: Manual Import (Admin Dashboard)
1. Sign in with an admin account
2. Go to `/admin`
3. Find the "Upcoming Releases Import (G20+)" section
4. Click "Import Upcoming Releases"
5. The import will fetch events for the next 30 days from configured sources

#### Option B: Automated Sync (Cron Job)
The app includes a Vercel Cron job that automatically syncs data daily:

- **Endpoint**: `/api/cron/sync-data`
- **Schedule**: Daily at 6:00 AM UTC (`0 6 * * *`)
- **Configuration**: `vercel.json` in the repository root

**Note:** Vercel Hobby plan limits cron jobs to once per day. For more frequent syncs, upgrade to Pro or use the manual import option.

For the cron job to work:
1. Ensure `CRON_SECRET` is set in Vercel environment variables
2. Vercel automatically adds the authorization header for configured crons
3. Monitor the Functions tab in Vercel for cron execution logs

### 15.5 Verify It's Working

After importing:
1. Go to the calendar at `/` (home page)
2. You should see scheduled releases for the next 30 days
3. Use filters to browse by country or category
4. Click on any indicator to see details

### 15.6 Troubleshooting

**No releases appearing:**
- Check that at least one API key is configured in Vercel
- Verify the API keys are valid (test in browser/curl)
- Check Vercel function logs for import errors
- Try a manual import from `/admin`

**Cron job not running:**
- Verify `CRON_SECRET` is set in Vercel
- Check the Functions tab in Vercel dashboard for cron logs
- Cron jobs only run in production (not preview deployments)

**Import errors:**
- API rate limits may cause partial imports
- Free tier limits: FMP (250/day), Finnhub (60/min)
- The import handles rate limits gracefully and imports what it can

---

## Quick Reference

**Vercel Dashboard**: [https://vercel.com/dashboard](https://vercel.com/dashboard)  
**Supabase Dashboard**: [https://app.supabase.com](https://app.supabase.com)  
**Production URL**: Check Vercel project settings  
**Support**: GitHub Issues in `InsightsLog/Insights` repository

---

**Last Updated**: January 2026  
**Version**: L4 (Global Data Acquisition)
