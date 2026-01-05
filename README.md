# Insights — Macro Calendar

## Overview
A public macroeconomic release calendar that displays upcoming economic indicator releases with search and filter capabilities. Users can view scheduled releases for the next 7-30 days, search by indicator name, filter by country and category, and explore historical release data.

## Project Structure
```
Insights/
├── SPEC.md              # Product specification (L0 scope)
├── TASKS.md             # Implementation task list
├── CHANGELOG.md         # Release history
├── BACKLOG.md           # Future feature ideas (L1+)
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

## Features (L0)
- **Calendar View:** Browse upcoming economic releases (next 7 days by default)
- **Search & Filter:** Find indicators by name, country, or category
- **Historical Data:** View past releases for each indicator
- **CSV Upload:** Admin interface for bulk data imports

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS
- **Validation:** Zod
- **Deployment:** Vercel

## Contributing
See [AGENTS.md](AGENTS.md) for coding standards and workflow rules.

## License
MIT