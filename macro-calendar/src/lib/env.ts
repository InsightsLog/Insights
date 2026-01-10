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
 * 
 * Note: ADMIN_UPLOAD_SECRET is optional during the migration period (T212).
 * Role-based auth is the primary authentication method; secret is fallback.
 */
const serverEnvSchema = z.object({
  ADMIN_UPLOAD_SECRET: z.string().optional(),
  UNSUBSCRIBE_TOKEN_SECRET: z.string().min(1, "UNSUBSCRIBE_TOKEN_SECRET is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
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
    UNSUBSCRIBE_TOKEN_SECRET: process.env.UNSUBSCRIBE_TOKEN_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
