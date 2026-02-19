/**
 * GET /api/v1/historical/:indicatorId - Get historical release data for an indicator
 *
 * Path parameters:
 * - indicatorId: Indicator UUID
 *
 * Query parameters:
 * - from_date: Start date (ISO 8601 format, inclusive)
 * - to_date: End date (ISO 8601 format, inclusive)
 * - limit: Number of results per page (1-1000, default 100)
 * - offset: Pagination offset (default 0)
 *
 * Requires valid API key in Authorization header.
 *
 * Task: T430 - Add historical data API endpoint
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

/**
 * Zod schema for path parameter validation.
 */
const pathParamsSchema = z.object({
  indicatorId: z.string().uuid("Invalid indicator ID format"),
});

/**
 * Zod schema for query parameters validation.
 */
const queryParamsSchema = z.object({
  from_date: z
    .string()
    .datetime({ message: "from_date must be a valid ISO 8601 datetime" })
    .optional(),
  to_date: z
    .string()
    .datetime({ message: "to_date must be a valid ISO 8601 datetime" })
    .optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

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
 * Pagination metadata.
 */
interface Pagination {
  total: number;
  limit: number;
  offset: number;
}

/**
 * Response type for the historical data endpoint.
 */
interface HistoricalDataResponse {
  data: Release[];
  pagination: Pagination;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> }
): Promise<NextResponse<HistoricalDataResponse | ApiErrorResponse>> {
  const startTime = Date.now();

  // Authenticate the request
  const authResult = await authenticateApiRequest(request);
  if (authResult instanceof NextResponse) {
    // Log failed auth attempts
    void logApiUsage(request, authResult.status, null, null, startTime);
    return authResult;
  }

  const { userId, apiKeyId } = authResult;

  // Validate path parameter
  const resolvedParams = await params;
  const pathParseResult = pathParamsSchema.safeParse({
    indicatorId: resolvedParams.indicatorId,
  });
  if (!pathParseResult.success) {
    const response = createApiErrorResponse(
      "Invalid indicator ID format",
      "INVALID_PARAMETER",
      400
    );
    void logApiUsage(request, 400, userId, apiKeyId, startTime);
    return response;
  }

  const { indicatorId } = pathParseResult.data;

  // Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const rawParams = {
    from_date: searchParams.get("from_date") ?? undefined,
    to_date: searchParams.get("to_date") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
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
    return response;
  }

  const { from_date, to_date, limit, offset } = queryParseResult.data;

  try {
    const supabase = createSupabaseServiceClient();

    // Verify the indicator exists
    const { error: indicatorError } = await supabase
      .from("indicators")
      .select("id")
      .eq("id", indicatorId)
      .single();

    if (indicatorError) {
      // PGRST116 is "no rows returned"
      if (indicatorError.code === "PGRST116") {
        const response = createApiErrorResponse(
          "Indicator not found",
          "NOT_FOUND",
          404
        );
        void logApiUsage(request, 404, userId, apiKeyId, startTime);
        return response;
      }
      console.error("Failed to fetch indicator:", indicatorError);
      const response = createApiErrorResponse(
        "Internal server error",
        "INTERNAL_ERROR",
        500
      );
      void logApiUsage(request, 500, userId, apiKeyId, startTime);
      return response;
    }

    // Build the query for releases
    let query = supabase
      .from("releases")
      .select(
        "id, indicator_id, release_at, period, actual, forecast, previous, revised, unit, revision_history, created_at",
        { count: "exact" }
      )
      .eq("indicator_id", indicatorId);

    // Apply date filters if provided
    if (from_date) {
      query = query.gte("release_at", from_date);
    }
    if (to_date) {
      query = query.lte("release_at", to_date);
    }

    // Order by release date (descending - most recent first)
    query = query.order("release_at", { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Failed to fetch historical releases:", error);
      const response = createApiErrorResponse(
        "Internal server error",
        "INTERNAL_ERROR",
        500
      );
      void logApiUsage(request, 500, userId, apiKeyId, startTime);
      return response;
    }

    // Map data to Release type
    const releases: Release[] = (data ?? []).map((rel) => ({
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

    const responseData: HistoricalDataResponse = {
      data: releases,
      pagination: {
        total: count ?? 0,
        limit,
        offset,
      },
    };

    // Log successful API request
    void logApiUsage(request, 200, userId, apiKeyId, startTime);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Unexpected error fetching historical releases:", error);
    const response = createApiErrorResponse(
      "Internal server error",
      "INTERNAL_ERROR",
      500
    );
    void logApiUsage(request, 500, userId, apiKeyId, startTime);
    return response;
  }
}
