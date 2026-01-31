# Insights — Macro Calendar

## Overview
A public macroeconomic release calendar with authenticated watchlists. Users can view upcoming releases, search/filter by country and category, sign in with a magic link, save indicators to a watchlist, and explore historical data.

## Production URL
**Live:** [https://insights-econ-watchs-projects.vercel.app](https://insights-econ-watchs-projects.vercel.app)

## Project Structure
```
Insights/
├── SPEC.md              # Product specification (L2 scope)
├── DEPLOY.md            # Deployment guide (Vercel + Supabase)
├── GETTING_STARTED.md   # User guide for deployed application
├── TRADING_GUIDE.md     # How to use macro data for trading
├── TASKS.md             # L0 task archive
├── TASKS_L1.md          # L1 task archive (shipped)
├── TASKS_L2.md          # Current implementation task list
├── CHANGELOG.md         # Release history
├── BACKLOG.md           # Future feature ideas (L3+)
├── AGENTS.md            # Agent coding rules
├── macro-calendar/      # Next.js application
│   ├── src/
│   │   ├── app/         # Pages and components
│   │   └── lib/         # Utilities (env validation, Supabase clients)
│   ├── supabase/        # Database migrations and seeds
│   └── package.json
└── README.md            # This file
```

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account (or local Supabase CLI setup)

### Setup
1. **Clone the repository:**
   ```bash
   git clone https://github.com/InsightsLog/Insights.git
   cd Insights/macro-calendar
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create `.env.local` in the `macro-calendar/` directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ADMIN_UPLOAD_SECRET=your-random-secret
   UNSUBSCRIBE_TOKEN_SECRET=your-random-secret-for-unsubscribe-tokens
   ```

4. **Run database migrations:**
   ```bash
   # Using Supabase CLI
   cd supabase
   supabase db push
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features (L1)
- **Magic-link auth:** Email-based sign-in with Supabase auth
- **Watchlists:** Save indicators from calendar or detail pages
- **Watchlist filter:** Toggle calendar to only saved indicators
- **Watchlist page:** View all saved indicators with next release date
- **Calendar & search:** Browse upcoming releases (next 7/30 days) with filters
- **Admin CSV upload:** Secure import/upsert of indicators and releases

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS
- **Validation:** Zod
- **Deployment:** Vercel

## Documentation

- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Complete user guide for the deployed application
- **[TRADING_GUIDE.md](TRADING_GUIDE.md)** - How to use macro economic data for trading decisions
- **[DEPLOY.md](DEPLOY.md)** - Step-by-step deployment instructions
- **[SPEC.md](SPEC.md)** - Product specification and feature roadmap

## Contributing
See [AGENTS.md](AGENTS.md) for coding standards and workflow rules.

## License
MIT