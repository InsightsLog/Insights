/**
 * Per-minute rate limiting for API endpoints
 *
 * Checks request count in request_logs for the current API key in the last 60s.
 * Free tier: 60 req/min. All paid tiers: 600 req/min.
 *
 * Task: T501 - Add rate limiting to API routes
 */

import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import { NextResponse } from "next/server";

/** Rate limit for the free tier (requests per 60 seconds). */
export const FREE_RATE_LIMIT = 60;

/** Rate limit for paid tiers (requests per 60 seconds). */
export const PRO_RATE_LIMIT = 600;

/** Window size in seconds for rate limiting. */
const RATE_LIMIT_WINDOW_SECONDS = 60;

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /** Whether the request is within the rate limit */
  allowed: boolean;
  /** Rate limit for this tier (requests per 60 seconds) */
  limit: number;
  /** Remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (seconds) when the current window expires */
  resetAt: number;
}

/**
 * Determine the applicable rate limit for a given plan name.
 * Free plan gets 60 req/min; all paid plans get 600 req/min.
 */
function getRateLimitForPlan(planName: string): number {
  return planName === "Free" ? FREE_RATE_LIMIT : PRO_RATE_LIMIT;
}

/**
 * Check the per-minute rate limit for an API key.
 *
 * Counts requests in request_logs for this api_key_id in the last 60 seconds
 * and compares against the limit for the user's current subscription plan.
 *
 * On database error the function fails open (allows the request) to avoid
 * blocking legitimate traffic when the DB is temporarily unavailable.
 *
 * @param apiKeyId - The API key ID whose recent requests should be counted
 * @param planName - The user's current plan name (e.g. "Free", "Pro")
 * @returns RateLimitResult with current status and header values
 */
export async function checkApiRateLimit(
  apiKeyId: string,
  planName: string
): Promise<RateLimitResult> {
  const limit = getRateLimitForPlan(planName);
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000);
  const resetAt = Math.floor(Date.now() / 1000) + RATE_LIMIT_WINDOW_SECONDS;

  const supabase = createSupabaseServiceClient();
  const { count, error } = await supabase
    .from("request_logs")
    .select("*", { count: "exact", head: true })
    .eq("api_key_id", apiKeyId)
    .gte("created_at", windowStart.toISOString());

  if (error) {
    console.error("[rate-limit] Failed to count requests:", error);
    // Fail open: allow the request on DB error
    return { allowed: true, limit, remaining: limit, resetAt };
  }

  const currentCount = count ?? 0;
  const remaining = Math.max(0, limit - currentCount);

  return {
    allowed: currentCount < limit,
    limit,
    remaining,
    resetAt,
  };
}

/**
 * Apply rate limit headers to a NextResponse.
 *
 * Sets the following headers (mutates the response in place):
 * - X-RateLimit-Limit: maximum requests per window
 * - X-RateLimit-Remaining: remaining requests in the current window
 * - X-RateLimit-Reset: Unix timestamp (seconds) when the window resets
 *
 * @param response - The NextResponse to add headers to
 * @param rateLimit - The rate limit result from checkApiRateLimit
 * @returns The same response object with headers applied
 */
export function applyRateLimitHeaders<T>(
  response: NextResponse<T>,
  rateLimit: RateLimitResult
): NextResponse<T> {
  response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
  response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
  response.headers.set("X-RateLimit-Reset", String(rateLimit.resetAt));
  return response;
}
