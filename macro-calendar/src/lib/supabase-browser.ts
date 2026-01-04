/**
 * Supabase client for client-side (browser) usage.
 * Uses the anon key for RLS-enabled access.
 * 
 * Note: We access NEXT_PUBLIC_* vars directly here rather than importing from env.ts
 * because client-side code receives these values inlined by Next.js at build time.
 */
"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// These are inlined by Next.js at build time for client-side code
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Returns a singleton Supabase client for browser usage.
 * Safe to call multiple times; returns the same instance.
 */
export function createBrowserClient() {
  if (client) {
    return client;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
    );
  }

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
