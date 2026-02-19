import { z } from "zod";

/**
 * Environment variable schema for Macro Calendar.
 * Validates required variables at build/runtime.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
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
  CRON_SECRET: z.string().optional(), // Used by Vercel Cron for authentication
});

/**
 * Validated environment variables.
 * Throws a clear error if any required variables are missing or invalid.
 */
export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
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
    CRON_SECRET: process.env.CRON_SECRET,
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

/**
 * Stripe environment variables schema.
 * Required for payment processing (T322).
 * STRIPE_SECRET_KEY: Server-side Stripe API key
 * STRIPE_WEBHOOK_SECRET: Used to verify Stripe webhook signatures
 */
const stripeEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "STRIPE_WEBHOOK_SECRET is required"),
});

/**
 * Get Stripe environment variables.
 * Returns null if Stripe is not configured.
 * Both keys must be set for Stripe integration to be enabled.
 */
export function getStripeEnv(): { secretKey: string; webhookSecret: string } | null {
  const result = stripeEnvSchema.safeParse({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  });

  if (!result.success) {
    return null;
  }

  return {
    secretKey: result.data.STRIPE_SECRET_KEY,
    webhookSecret: result.data.STRIPE_WEBHOOK_SECRET,
  };
}

/**
 * FRED API environment variables schema.
 * Optional: API key for Federal Reserve Economic Data (FRED) integration.
 */
const fredEnvSchema = z.object({
  FRED_API_KEY: z.string().optional(),
});

/**
 * Get FRED API environment variables.
 * Returns null if FRED API is not configured.
 */
export function getFredEnv(): { apiKey: string } | null {
  const result = fredEnvSchema.safeParse({
    FRED_API_KEY: process.env.FRED_API_KEY,
  });

  if (!result.success || !result.data.FRED_API_KEY) {
    return null;
  }

  return {
    apiKey: result.data.FRED_API_KEY,
  };
}

/**
 * Stripe price ID environment variables schema.
 * Optional: Maps plan names to Stripe price IDs for subscriptions.
 * These can be set as environment variables or stored in the database.
 * Environment variables take precedence as fallback when DB values are not set.
 *
 * Format: STRIPE_PRICE_{PLAN}_{INTERVAL}
 * Example: STRIPE_PRICE_PLUS_MONTHLY=price_xxx
 */
const stripePriceEnvSchema = z.object({
  STRIPE_PRICE_PLUS_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PLUS_YEARLY: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE_YEARLY: z.string().optional(),
});

/**
 * Plan price ID configuration from environment variables.
 */
export type StripePriceConfig = {
  plus?: { monthly?: string; yearly?: string };
  pro?: { monthly?: string; yearly?: string };
  enterprise?: { monthly?: string; yearly?: string };
};

/**
 * Get Stripe price IDs from environment variables.
 * Returns a configuration object mapping plan names to their Stripe price IDs.
 * Used as fallback when price IDs are not configured in the database.
 */
export function getStripePriceEnv(): StripePriceConfig {
  const parsed = stripePriceEnvSchema.parse({
    STRIPE_PRICE_PLUS_MONTHLY: process.env.STRIPE_PRICE_PLUS_MONTHLY,
    STRIPE_PRICE_PLUS_YEARLY: process.env.STRIPE_PRICE_PLUS_YEARLY,
    STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY,
    STRIPE_PRICE_PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY,
    STRIPE_PRICE_ENTERPRISE_MONTHLY: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    STRIPE_PRICE_ENTERPRISE_YEARLY: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
  });

  return {
    plus: {
      monthly: parsed.STRIPE_PRICE_PLUS_MONTHLY,
      yearly: parsed.STRIPE_PRICE_PLUS_YEARLY,
    },
    pro: {
      monthly: parsed.STRIPE_PRICE_PRO_MONTHLY,
      yearly: parsed.STRIPE_PRICE_PRO_YEARLY,
    },
    enterprise: {
      monthly: parsed.STRIPE_PRICE_ENTERPRISE_MONTHLY,
      yearly: parsed.STRIPE_PRICE_ENTERPRISE_YEARLY,
    },
  };
}

/**
 * Data source API keys environment variables schema.
 * Optional: External data source API integrations (T404-T406).
 * BLS_API_KEY: Bureau of Labor Statistics API key for employment data
 */
const dataSourceEnvSchema = z.object({
  BLS_API_KEY: z.string().optional(),
});

/**
 * Get data source API keys from environment variables.
 * Returns null if data source API keys are not configured.
 */
export function getDataSourceEnv(): { blsApiKey?: string } | null {
  const result = dataSourceEnvSchema.safeParse({
    BLS_API_KEY: process.env.BLS_API_KEY,
  });

  if (!result.success) {
    return null;
  }

  return {
    blsApiKey: result.data.BLS_API_KEY,
  };
}
