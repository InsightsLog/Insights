/**
 * API Key Authentication for Public REST API
 *
 * This module provides authentication helpers for the /api/v1/ endpoints.
 * It validates API keys from the Authorization header and returns the user ID.
 *
 * Task: T311 - Add /api/v1/indicators endpoint
 * Task: T324 - Add usage quota enforcement
 */

import { createHash } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import { NextRequest, NextResponse } from "next/server";
import {
  checkApiQuota,
  formatQuotaExceededMessage,
  type QuotaCheckResult,
} from "@/lib/api/quota";
import {
  checkApiRateLimit,
  applyRateLimitHeaders,
  type RateLimitResult,
} from "@/lib/rate-limit";

/**
 * Result of API key validation.
 */
export interface ApiAuthResult {
  /** Whether the API key is valid */
  valid: boolean;
  /** User ID if valid, null otherwise */
  userId: string | null;
  /** API key ID if valid, null otherwise (T314 - usage tracking) */
  apiKeyId: string | null;
  /** Error message if invalid */
  error?: string;
  /** HTTP status code to return if invalid */
  status?: number;
}

/**
 * Hash an API key using SHA-256.
 * This matches the hashing used when creating API keys.
 */
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Extract API key from Authorization header.
 * Expected format: "Bearer mc_xxxxx" or just "mc_xxxxx"
 *
 * @param authHeader - The Authorization header value
 * @returns The API key if found, null otherwise
 */
function extractApiKey(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <key>" and just "<key>"
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    return bearerMatch[1];
  }

  // Fallback: if it starts with mc_, treat it as a direct key
  if (authHeader.startsWith("mc_")) {
    return authHeader;
  }

  return null;
}

/**
 * Validate an API key from the Authorization header.
 * Uses the service role client to bypass RLS for key lookup.
 *
 * @param request - The incoming NextRequest
 * @returns ApiAuthResult with validation status and user ID
 */
export async function validateApiKeyFromHeader(
  request: NextRequest
): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("authorization");
  const apiKey = extractApiKey(authHeader);

  if (!apiKey) {
    return {
      valid: false,
      userId: null,
      apiKeyId: null,
      error: "Invalid or missing API key",
      status: 401,
    };
  }

  // Basic format validation
  if (!apiKey.startsWith("mc_") || apiKey.length < 10) {
    return {
      valid: false,
      userId: null,
      apiKeyId: null,
      error: "Invalid or missing API key",
      status: 401,
    };
  }

  const keyHash = hashApiKey(apiKey);
  const supabase = createSupabaseServiceClient();

  // Look up key by hash, ensure not revoked (include id for usage tracking T314)
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !data) {
    // PGRST116 is "no rows returned"
    return {
      valid: false,
      userId: null,
      apiKeyId: null,
      error: "Invalid or missing API key",
      status: 401,
    };
  }

  // Check if revoked
  if (data.revoked_at) {
    return {
      valid: false,
      userId: null,
      apiKeyId: null,
      error: "API key has been revoked",
      status: 401,
    };
  }

  // Update last_used_at timestamp (non-blocking)
  void Promise.resolve(
    supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", keyHash)
  ).catch((err) => {
    // Log error for debugging but don't fail authentication
    console.error("[API Auth] Failed to update last_used_at:", err);
  });

  return {
    valid: true,
    userId: data.user_id,
    apiKeyId: data.id,
  };
}

/**
 * Error response type for API endpoints.
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  /** Quota information for quota exceeded errors (T324) */
  quota?: {
    current: number;
    limit: number;
    reset_at: string;
    plan: string;
  };
}

/**
 * Create a standardized JSON error response for API endpoints.
 *
 * @param error - Error message
 * @param code - Optional error code (e.g., "UNAUTHORIZED")
 * @param status - HTTP status code (default 500)
 * @param quota - Optional quota information for 429 responses (T324)
 * @returns NextResponse with JSON error body
 */
export function createApiErrorResponse(
  error: string,
  code?: string,
  status: number = 500,
  quota?: QuotaCheckResult
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = { error };
  if (code) {
    body.code = code;
  }
  if (quota) {
    body.quota = {
      current: quota.currentUsage,
      limit: quota.limit,
      reset_at: quota.resetAt,
      plan: quota.planName,
    };
  }
  return NextResponse.json(body, { status });
}

/**
 * Wrapper function to authenticate API requests and check quota.
 * Returns an error response if authentication fails or quota is exceeded,
 * or the user ID and API key ID if successful.
 *
 * Task: T324 - Added quota enforcement
 *
 * @param request - The incoming NextRequest
 * @returns Either an error NextResponse or the authenticated user ID and API key ID
 */
export async function authenticateApiRequest(
  request: NextRequest
): Promise<
  | NextResponse<ApiErrorResponse>
  | { userId: string; apiKeyId: string; rateLimit: RateLimitResult }
> {
  const authResult = await validateApiKeyFromHeader(request);

  if (!authResult.valid || !authResult.userId || !authResult.apiKeyId) {
    return createApiErrorResponse(
      authResult.error ?? "Authentication failed",
      "UNAUTHORIZED",
      authResult.status ?? 401
    );
  }

  // At this point, userId and apiKeyId are guaranteed to exist
  const { userId, apiKeyId } = authResult;

  // Check API quota (T324)
  const quotaResult = await checkApiQuota(userId);
  if (!quotaResult.allowed) {
    return createApiErrorResponse(
      formatQuotaExceededMessage(quotaResult),
      "QUOTA_EXCEEDED",
      429,
      quotaResult
    );
  }

  // Check per-minute rate limit (T501)
  const rateLimit = await checkApiRateLimit(apiKeyId, quotaResult.planName);
  if (!rateLimit.allowed) {
    const response = createApiErrorResponse(
      "Rate limit exceeded. Too many requests in the last 60 seconds.",
      "RATE_LIMIT_EXCEEDED",
      429
    );
    const retryAfterSeconds = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000));
    response.headers.set("Retry-After", String(retryAfterSeconds));
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  return { userId, apiKeyId, rateLimit };
}
