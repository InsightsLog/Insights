/**
 * GET /api/v1/historical/:indicator_id - Historical time series data
 *
 * Returns historical release data for a specific indicator as a time series.
 * Designed for backtesting and analytical use cases.
 *
 * Query parameters:
 * - from_date: Filter releases from this date (ISO 8601)
 * - to_date: Filter releases until this date (ISO 8601)
 * - limit: Number of results to return (1-500, default 100)
 * - offset: Number of results to skip for pagination (default 0)
 *
 * Requires valid API key in Authorization header.
 * Quota-enforced based on subscription plan.
 *
 * Task: T430 - Add /api/v1/historical endpoint
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
 * Zod schema for query parameter validation.
 * Higher default limit (100) and max (500) compared to the releases endpoint,
 * since historical queries typically request larger datasets.
 */
const queryParamsSchema = z.object({
  from_date: z
    .string()
    .refine(
      (val) => !isNaN(Date.parse(val)),
      "Invalid from_date format - must be ISO 8601"
    )
    .optional(),
  to_date: z
    .string()
    .refine(
      (val) => !isNaN(Date.parse(val)),
      "Invalid to_date format - must be ISO 8601"
    )
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * A single historical data point in the time series.
 */
interface HistoricalDataPoint {
  release_id: string;
  date: string;
  period: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  revised: string | null;
  unit: string | null;
  surprise: number | null;
}

/**
 * Indicator metadata included in the response.
 */
interface IndicatorMeta {
  id: string;
  name: string;
  country_code: string;
  category: string;
  source_name: string;
}

/**
 * Pagination metadata.
 */
interface Pagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/**
 * Response type for the historical endpoint.
 */
interface HistoricalResponse {
  indicator: IndicatorMeta;
  data: HistoricalDataPoint[];
  pagination: Pagination;
}

/**
 * Calculate surprise value (actual - forecast) when both are numeric.
 */
function calculateSurprise(
  actual: string | null,
  forecast: string | null
): number | null {
  if (!actual || !forecast) return null;

  // Strip common formatting (%, K, M, B, commas)
  const cleanNum = (s: string) =>
    parseFloat(s.replace(/[%,KMBkmb]/g, "").trim());

  const actualNum = cleanNum(actual);
  const forecastNum = cleanNum(forecast);

  if (isNaN(actualNum) || isNaN(forecastNum)) return null;

  // Round to avoid floating point artifacts
  return Math.round((actualNum - forecastNum) * 10000) / 10000;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ indicator_id: string }> }
): Promise<NextResponse<HistoricalResponse | ApiErrorResponse>> {
  const startTime = Date.now();
  const { indicator_id } = await params;

  // Authenticate the request
  const authResult = await authenticateApiRequest(request);
  if (authResult instanceof NextResponse) {
    void logApiUsage(request, authResult.status, null, null, startTime);
    return authResult;
  }

  const { userId, apiKeyId } = authResult;

  // Validate indicator_id format
  const idResult = z.string().uuid("Invalid indicator ID format").safeParse(indicator_id);
  if (!idResult.success) {
    const response = createApiErrorResponse(
      "Invalid indicator_id format - must be a valid UUID",
      "INVALID_PARAMETER",
      400
    );
    void logApiUsage(request, 400, userId, apiKeyId, startTime);
    return response;
  }

  // Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const rawParams = {
    from_date: searchParams.get("from_date") ?? undefined,
    to_date: searchParams.get("to_date") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  };

  const parseResult = queryParamsSchema.safeParse(rawParams);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    const response = createApiErrorResponse(
      `Invalid parameter: ${firstError?.path.join(".")} - ${firstError?.message}`,
      "INVALID_PARAMETER",
      400
    );
    void logApiUsage(request, 400, userId, apiKeyId, startTime);
    return response;
  }

  const { from_date, to_date, limit, offset } = parseResult.data;

  try {
    const supabase = createSupabaseServiceClient();

    // Verify the indicator exists
    const { data: indicator, error: indicatorError } = await supabase
      .from("indicators")
      .select("id, name, country_code, category, source_name")
      .eq("id", indicator_id)
      .single();

    if (indicatorError || !indicator) {
      const response = createApiErrorResponse(
        "Indicator not found",
        "NOT_FOUND",
        404
      );
      void logApiUsage(request, 404, userId, apiKeyId, startTime);
      return response;
    }

    // Build the releases query for this indicator
    let query = supabase
      .from("releases")
      .select(
        "id, release_at, period, actual, forecast, previous, revised, unit",
        { count: "exact" }
      )
      .eq("indicator_id", indicator_id);

    // Apply date filters
    if (from_date) {
      query = query.gte("release_at", from_date);
    }
    if (to_date) {
      query = query.lte("release_at", to_date);
    }

    // Order chronologically (oldest first for time series)
    query = query.order("release_at", { ascending: true });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: releases, error: releasesError, count } = await query;

    if (releasesError) {
      console.error("Failed to fetch historical data:", releasesError);
      const response = createApiErrorResponse(
        "Internal server error",
        "INTERNAL_ERROR",
        500
      );
      void logApiUsage(request, 500, userId, apiKeyId, startTime);
      return response;
    }

    const total = count ?? 0;
    const dataPoints: HistoricalDataPoint[] = (releases ?? []).map((rel) => ({
      release_id: rel.id,
      date: rel.release_at,
      period: rel.period,
      actual: rel.actual,
      forecast: rel.forecast,
      previous: rel.previous,
      revised: rel.revised,
      unit: rel.unit,
      surprise: calculateSurprise(rel.actual, rel.forecast),
    }));

    const responseData: HistoricalResponse = {
      indicator: {
        id: indicator.id,
        name: indicator.name,
        country_code: indicator.country_code,
        category: indicator.category,
        source_name: indicator.source_name,
      },
      data: dataPoints,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + dataPoints.length < total,
      },
    };

    void logApiUsage(request, 200, userId, apiKeyId, startTime);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Unexpected error fetching historical data:", error);
    const response = createApiErrorResponse(
      "Internal server error",
      "INTERNAL_ERROR",
      500
    );
    void logApiUsage(request, 500, userId, apiKeyId, startTime);
    return response;
  }
}
