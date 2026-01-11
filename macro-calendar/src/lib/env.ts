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

/**
 * Rate limiting environment variables schema.
 * Optional: If not set, rate limiting is disabled.
 * Used by @upstash/ratelimit for distributed rate limiting.
 */
const rateLimitEnvSchema = z.object({
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

/**
 * Get rate limiting environment variables.
 * Returns null if rate limiting is not configured.
 * Both URL and token must be set for rate limiting to be enabled.
 */
export function getRateLimitEnv(): { url: string; token: string } | null {
  const parsed = rateLimitEnvSchema.parse({
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  // Both must be set for rate limiting to be enabled
  if (parsed.UPSTASH_REDIS_REST_URL && parsed.UPSTASH_REDIS_REST_TOKEN) {
    return {
      url: parsed.UPSTASH_REDIS_REST_URL,
      token: parsed.UPSTASH_REDIS_REST_TOKEN,
    };
  }

  return null;
}

/**
 * Request logging environment variables schema.
 * Optional: If not set (or set to 'false'), request logging is disabled.
 * Used by middleware for abuse detection (T222).
 */
const requestLoggingEnvSchema = z.object({
  ENABLE_REQUEST_LOGGING: z.string().optional(),
});

/**
 * Check if request logging is enabled.
 * Returns true if ENABLE_REQUEST_LOGGING is set to 'true'.
 * Requires SUPABASE_SERVICE_ROLE_KEY to be set for actual logging.
 */
export function isRequestLoggingEnabled(): boolean {
  const parsed = requestLoggingEnvSchema.parse({
    ENABLE_REQUEST_LOGGING: process.env.ENABLE_REQUEST_LOGGING,
  });

  return parsed.ENABLE_REQUEST_LOGGING === "true";
}
