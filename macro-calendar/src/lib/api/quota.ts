/**
 * API Usage Quota Enforcement Module
 *
 * This module provides quota checking for the Public REST API.
 * It enforces monthly API call limits based on the user's subscription plan.
 *
 * Task: T324 - Add usage quota enforcement
 */

import { createSupabaseServiceClient } from "@/lib/supabase/service-role";

/**
 * Default API calls limit for users without a subscription (Free tier).
 * This should match the Free plan's api_calls_limit in the plans table.
 */
const DEFAULT_API_CALLS_LIMIT = 100;

/**
 * Active subscription statuses that grant the user their plan's quota.
 * Users with other statuses (canceled, past_due) fall back to Free tier limits.
 */
const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

/**
 * Result of a quota check.
 */
export interface QuotaCheckResult {
  /** Whether the user is within their quota */
  allowed: boolean;
  /** Current number of API calls this period */
  currentUsage: number;
  /** Maximum API calls allowed this period */
  limit: number;
  /** When the quota will reset (start of next month) */
  resetAt: string;
  /** User's current plan name */
  planName: string;
}

/**
 * Get the start of the current billing period (first day of current month at 00:00:00 UTC).
 */
function getBillingPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Get the start of the next billing period (first day of next month at 00:00:00 UTC).
 */
function getBillingPeriodEnd(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/**
 * Check if a user has exceeded their API quota for the current billing period.
 *
 * The quota is determined by:
 * 1. Looking up the user's subscription and associated plan
 * 2. Using the plan's api_calls_limit
 * 3. If no subscription exists, using the default Free tier limit
 *
 * API calls are counted from the request_logs table for the current month,
 * filtering by api_key_id that belongs to the user.
 *
 * @param userId - The user ID to check quota for
 * @returns QuotaCheckResult with current usage and limit information
 */
export async function checkApiQuota(userId: string): Promise<QuotaCheckResult> {
  const supabase = createSupabaseServiceClient();

  // Get the billing period boundaries
  const periodStart = getBillingPeriodStart();
  const periodEnd = getBillingPeriodEnd();

  // Fetch user's subscription with plan details
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(
      `
      status,
      plans (
        name,
        api_calls_limit
      )
    `
    )
    .eq("user_id", userId)
    .in("status", ACTIVE_SUBSCRIPTION_STATUSES as unknown as string[])
    .single();

  // Determine the plan limit
  let limit = DEFAULT_API_CALLS_LIMIT;
  let planName = "Free";

  if (subscription?.plans) {
    // Supabase may return embedded relations as arrays
    const planData = Array.isArray(subscription.plans)
      ? subscription.plans[0]
      : subscription.plans;

    if (planData) {
      limit = planData.api_calls_limit;
      planName = planData.name;
    }
  }

  // Get all API keys for the user
  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("id")
    .eq("user_id", userId)
    .is("revoked_at", null);

  // If user has no API keys, they have 0 usage
  if (!apiKeys || apiKeys.length === 0) {
    return {
      allowed: true,
      currentUsage: 0,
      limit,
      resetAt: periodEnd.toISOString(),
      planName,
    };
  }

  // Count API calls for this billing period across all user's API keys
  const apiKeyIds = apiKeys.map((k) => k.id);
  const { count, error } = await supabase
    .from("request_logs")
    .select("*", { count: "exact", head: true })
    .in("api_key_id", apiKeyIds)
    .gte("created_at", periodStart.toISOString())
    .lt("created_at", periodEnd.toISOString());

  if (error) {
    console.error("[quota] Failed to count API calls:", error);
    // On error, allow the request (fail open) but log the issue
    return {
      allowed: true,
      currentUsage: 0,
      limit,
      resetAt: periodEnd.toISOString(),
      planName,
    };
  }

  const currentUsage = count ?? 0;

  return {
    allowed: currentUsage < limit,
    currentUsage,
    limit,
    resetAt: periodEnd.toISOString(),
    planName,
  };
}

/**
 * Format a quota exceeded message with upgrade prompt.
 *
 * @param result - The quota check result
 * @returns Formatted error message
 */
export function formatQuotaExceededMessage(result: QuotaCheckResult): string {
  const resetDate = new Date(result.resetAt);
  const resetFormatted = resetDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    `API quota exceeded. You have used ${result.currentUsage} of ${result.limit} ` +
    `API calls this month on the ${result.planName} plan. ` +
    `Your quota will reset on ${resetFormatted}. ` +
    `Upgrade your plan at /settings/billing for higher limits.`
  );
}
