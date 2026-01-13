/**
 * API Usage Logging Helper for Public REST API
 *
 * This module provides a helper to log API requests with usage tracking data.
 * Used by /api/v1/ endpoints to track per-key usage statistics.
 *
 * Task: T314 - Add API usage tracking
 */

import { NextRequest } from "next/server";
import { logRequest, createApiLogEntry } from "@/lib/request-logger";
import { isRequestLoggingEnabled } from "@/lib/env";

/**
 * Extract client IP from request headers.
 * Checks x-forwarded-for first (for proxied requests), then falls back to x-real-ip.
 *
 * @param request - The incoming NextRequest
 * @returns Client IP address or "unknown"
 */
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one (client)
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

/**
 * Extract the endpoint path from request URL.
 * Strips the host and query parameters to get the clean path.
 *
 * @param request - The incoming NextRequest
 * @returns The request path (e.g., '/api/v1/indicators')
 */
function getEndpointPath(request: NextRequest): string {
  try {
    const url = new URL(request.url);
    return url.pathname;
  } catch {
    return request.url;
  }
}

/**
 * Log an API request with usage tracking data.
 * This function is designed to be called asynchronously after the response is sent.
 * It will not block the response and will fail silently if logging is disabled.
 *
 * @param request - The incoming NextRequest
 * @param responseCode - HTTP response status code
 * @param userId - User ID associated with the API key
 * @param apiKeyId - API key ID used for the request
 * @param startTime - Request start time (from Date.now() or performance.now())
 */
export async function logApiUsage(
  request: NextRequest,
  responseCode: number,
  userId: string | null,
  apiKeyId: string | null,
  startTime: number
): Promise<void> {
  // Check if logging is enabled
  if (!isRequestLoggingEnabled()) {
    return;
  }

  // Calculate response time
  const responseTimeMs = Math.round(Date.now() - startTime);

  // Create and log the entry
  const entry = createApiLogEntry(
    getClientIp(request),
    getEndpointPath(request),
    responseCode,
    userId,
    apiKeyId,
    responseTimeMs
  );

  // Log the request (fire-and-forget)
  await logRequest(entry);
}
