/**
 * API Key Authentication for Public REST API
 *
 * This module provides authentication helpers for the /api/v1/ endpoints.
 * It validates API keys from the Authorization header and returns the user ID.
 *
 * Task: T311 - Add /api/v1/indicators endpoint
 */

import { createHash } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import { NextRequest, NextResponse } from "next/server";

/**
 * Result of API key validation.
 */
export interface ApiAuthResult {
  /** Whether the API key is valid */
  valid: boolean;
  /** User ID if valid, null otherwise */
  userId: string | null;
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
      error: "Invalid or missing API key",
      status: 401,
    };
  }

  // Basic format validation
  if (!apiKey.startsWith("mc_") || apiKey.length < 10) {
    return {
      valid: false,
      userId: null,
      error: "Invalid or missing API key",
      status: 401,
    };
  }

  const keyHash = hashApiKey(apiKey);
  const supabase = createSupabaseServiceClient();

  // Look up key by hash, ensure not revoked
  const { data, error } = await supabase
    .from("api_keys")
    .select("user_id, revoked_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !data) {
    // PGRST116 is "no rows returned"
    return {
      valid: false,
      userId: null,
      error: "Invalid or missing API key",
      status: 401,
    };
  }

  // Check if revoked
  if (data.revoked_at) {
    return {
      valid: false,
      userId: null,
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
  ).catch(() => {
    // Intentionally ignored - fire and forget
  });

  return {
    valid: true,
    userId: data.user_id,
  };
}

/**
 * Error response type for API endpoints.
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
}

/**
 * Create a standardized JSON error response for API endpoints.
 *
 * @param error - Error message
 * @param code - Optional error code (e.g., "UNAUTHORIZED")
 * @param status - HTTP status code (default 500)
 * @returns NextResponse with JSON error body
 */
export function createApiErrorResponse(
  error: string,
  code?: string,
  status: number = 500
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = { error };
  if (code) {
    body.code = code;
  }
  return NextResponse.json(body, { status });
}

/**
 * Wrapper function to authenticate API requests.
 * Returns an error response if authentication fails, or the user ID if successful.
 *
 * @param request - The incoming NextRequest
 * @returns Either an error NextResponse or the authenticated user ID
 */
export async function authenticateApiRequest(
  request: NextRequest
): Promise<NextResponse<ApiErrorResponse> | { userId: string }> {
  const authResult = await validateApiKeyFromHeader(request);

  if (!authResult.valid) {
    return createApiErrorResponse(
      authResult.error ?? "Authentication failed",
      "UNAUTHORIZED",
      authResult.status ?? 401
    );
  }

  return { userId: authResult.userId! };
}
