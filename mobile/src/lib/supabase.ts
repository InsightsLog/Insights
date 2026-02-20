/**
 * Supabase client for the mobile app.
 *
 * Uses the public anon key. RLS enforces row-level access so only the
 * authenticated user's own data is returned from user-specific tables
 * (watchlist, alert_preferences, etc.).
 *
 * Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in
 * your .env or app.json extra config.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? '';

const supabaseAnonKey =
  process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
