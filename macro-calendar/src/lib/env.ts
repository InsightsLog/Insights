import { z } from "zod";

/**
 * Environment variable schema for Macro Calendar.
 * Validates required variables at build/runtime.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

/**
 * Server-only environment variables.
 * These are not exposed to the client and validated on-demand.
 */
const serverEnvSchema = z.object({
  ADMIN_UPLOAD_SECRET: z.string().min(1, "ADMIN_UPLOAD_SECRET is required"),
});

/**
 * Validated environment variables.
 * Throws a clear error if any required variables are missing or invalid.
 */
export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/**
 * Get server-only environment variables.
 * Validates and returns server-side secrets. Call only from server code.
 */
export function getServerEnv() {
  return serverEnvSchema.parse({
    ADMIN_UPLOAD_SECRET: process.env.ADMIN_UPLOAD_SECRET,
  });
}
