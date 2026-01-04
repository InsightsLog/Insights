/**
 * Supabase client for server-side usage (Server Components, Route Handlers, Server Actions).
 * Uses the anon key for RLS-enabled access.
 */
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Creates a Supabase client for server-side usage.
 * Call this function in Server Components, Route Handlers, or Server Actions.
 */
export function createServerClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
