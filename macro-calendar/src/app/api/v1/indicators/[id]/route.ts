/**
 * GET /api/v1/indicators/:id - Get a single indicator with latest releases
 *
 * Path parameters:
 * - id: Indicator UUID
 *
 * Query parameters:
 * - include_releases: Include latest releases in response (default true)
 * - releases_limit: Number of releases to include (1-100, default 10)
 *
 * Requires valid API key in Authorization header.
 *
 * Task: T311 - Add /api/v1/indicators endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import {
  authenticateApiRequest,
  createApiErrorResponse,
  type ApiErrorResponse,
} from "@/lib/api/auth";
import { logApiUsage } from "@/lib/api/usage-logger";
import { applyRateLimitHeaders } from "@/lib/rate-limit";

/**
 * Zod schema for path parameter validation.
 */
const pathParamsSchema = z.object({
  id: z.string().uuid("Invalid indicator ID format"),
});

/**
 * Zod schema for query parameters validation.
 * Note: include_releases defaults to true when not provided (undefined !== "false")
 */
const queryParamsSchema = z.object({
  include_releases: z
    .string()
    .optional()
    .transform((val) => val !== "false"),
  releases_limit: z.coerce.number().int().min(1).max(100).default(10),
});

/**
 * Indicator type matching the database schema.
 */
interface Indicator {
  id: string;
  name: string;
  country_code: string;
  category: string;
  source_name: string;
  source_url: string | null;
  created_at: string;
}

/**
 * Revision history entry type.
 */
interface Revision {
  previous_actual: string;
  new_actual: string;
  revised_at: string;
}

/**
 * Release type matching the database schema.
 */
interface Release {
  id: string;
  indicator_id: string;
  release_at: string;
  period: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  revised: string | null;
  unit: string | null;
  revision_history?: Revision[];
  created_at: string;
}

/**
 * Response type for the single indicator endpoint.
 */
interface IndicatorWithReleases extends Indicator {
  releases?: Release[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<IndicatorWithReleases | ApiErrorResponse>> {
  const startTime = Date.now();

  // Authenticate the request
  const authResult = await authenticateApiRequest(request);
  if (authResult instanceof NextResponse) {
    // Log failed auth attempts (T314 - API usage tracking)
    void logApiUsage(request, authResult.status, null, null, startTime);
    return authResult;
  }

  const { userId, apiKeyId, rateLimit } = authResult;

  // Validate path parameter
  const resolvedParams = await params;
  const pathParseResult = pathParamsSchema.safeParse({ id: resolvedParams.id });
  if (!pathParseResult.success) {
    const response = createApiErrorResponse(
      "Invalid indicator ID format",
      "INVALID_PARAMETER",
      400
    );
    void logApiUsage(request, 400, userId, apiKeyId, startTime);
    return applyRateLimitHeaders(response, rateLimit);
  }

  const { id } = pathParseResult.data;

  // Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const rawParams = {
    include_releases: searchParams.get("include_releases") ?? undefined,
    releases_limit: searchParams.get("releases_limit") ?? undefined,
  };

  const queryParseResult = queryParamsSchema.safeParse(rawParams);
  if (!queryParseResult.success) {
    const firstError = queryParseResult.error.issues[0];
    const response = createApiErrorResponse(
      `Invalid parameter: ${firstError?.path.join(".")} - ${firstError?.message}`,
      "INVALID_PARAMETER",
      400
    );
    void logApiUsage(request, 400, userId, apiKeyId, startTime);
    return applyRateLimitHeaders(response, rateLimit);
  }

  const { include_releases, releases_limit } = queryParseResult.data;

  try {
    const supabase = createSupabaseServiceClient();

    // Fetch the indicator
    const { data: indicator, error: indicatorError } = await supabase
      .from("indicators")
      .select("id, name, country_code, category, source_name, source_url, created_at")
      .eq("id", id)
      .single();

    if (indicatorError) {
      // PGRST116 is "no rows returned"
      if (indicatorError.code === "PGRST116") {
        const response = createApiErrorResponse("Indicator not found", "NOT_FOUND", 404);
        void logApiUsage(request, 404, userId, apiKeyId, startTime);
        return applyRateLimitHeaders(response, rateLimit);
      }
      console.error("Failed to fetch indicator:", indicatorError);
      const response = createApiErrorResponse(
        "Internal server error",
        "INTERNAL_ERROR",
        500
      );
      void logApiUsage(request, 500, userId, apiKeyId, startTime);
      return applyRateLimitHeaders(response, rateLimit);
    }

    const responseData: IndicatorWithReleases = {
      id: indicator.id,
      name: indicator.name,
      country_code: indicator.country_code,
      category: indicator.category,
      source_name: indicator.source_name,
      source_url: indicator.source_url,
      created_at: indicator.created_at,
    };

    // Fetch releases if requested
    if (include_releases) {
      const { data: releases, error: releasesError } = await supabase
        .from("releases")
        .select("id, indicator_id, release_at, period, actual, forecast, previous, revised, unit, revision_history, created_at")
        .eq("indicator_id", id)
        .order("release_at", { ascending: false })
        .limit(releases_limit);

      if (releasesError) {
        console.error("Failed to fetch releases:", releasesError);
        // Continue without releases rather than failing the entire request
        responseData.releases = [];
      } else {
        responseData.releases = (releases ?? []).map((rel) => ({
          id: rel.id,
          indicator_id: rel.indicator_id,
          release_at: rel.release_at,
          period: rel.period,
          actual: rel.actual,
          forecast: rel.forecast,
          previous: rel.previous,
          revised: rel.revised,
          unit: rel.unit,
          revision_history: rel.revision_history as Revision[] | undefined,
          created_at: rel.created_at,
        }));
      }
    }

    // Log successful API request (T314 - API usage tracking)
    void logApiUsage(request, 200, userId, apiKeyId, startTime);

    return applyRateLimitHeaders(NextResponse.json(responseData), rateLimit);
  } catch (error) {
    console.error("Unexpected error fetching indicator:", error);
    const response = createApiErrorResponse(
      "Internal server error",
      "INTERNAL_ERROR",
      500
    );
    void logApiUsage(request, 500, userId, apiKeyId, startTime);
    return applyRateLimitHeaders(response, rateLimit);
  }
}
