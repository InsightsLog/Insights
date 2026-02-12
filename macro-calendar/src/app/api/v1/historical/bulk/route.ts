/**
 * GET /api/v1/historical/bulk - Bulk historical data export
 *
 * Export historical release data for multiple indicators in a single request.
 * Supports JSON and CSV output formats.
 *
 * Query parameters:
 * - indicator_ids: Comma-separated list of indicator UUIDs (required, max 10)
 * - from_date: Filter releases from this date (ISO 8601)
 * - to_date: Filter releases until this date (ISO 8601)
 * - format: Output format - 'json' (default) or 'csv'
 * - limit: Max results per indicator (1-500, default 100)
 *
 * Requires valid API key in Authorization header.
 * Quota-enforced based on subscription plan.
 *
 * Task: T431 - Add bulk historical data export
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
 * Maximum number of indicators per bulk request.
 */
const MAX_BULK_INDICATORS = 10;

/**
 * Zod schema for query parameter validation.
 */
const queryParamsSchema = z.object({
  indicator_ids: z
    .string()
    .min(1, "indicator_ids is required")
    .refine((val) => {
      const ids = val.split(",").map((s) => s.trim());
      return ids.length <= MAX_BULK_INDICATORS;
    }, `Maximum ${MAX_BULK_INDICATORS} indicators per request`)
    .refine((val) => {
      const ids = val.split(",").map((s) => s.trim());
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return ids.every((id) => uuidRegex.test(id));
    }, "All indicator_ids must be valid UUIDs"),
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
  format: z.enum(["json", "csv"]).default("json"),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

/**
 * Data point for a single release.
 */
interface BulkDataPoint {
  indicator_id: string;
  indicator_name: string;
  country_code: string;
  category: string;
  date: string;
  period: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  revised: string | null;
  unit: string | null;
}

/**
 * Indicator summary in the JSON response.
 */
interface IndicatorSummary {
  id: string;
  name: string;
  country_code: string;
  category: string;
  data_points: number;
}

/**
 * JSON response type.
 */
interface BulkHistoricalResponse {
  indicators: IndicatorSummary[];
  data: BulkDataPoint[];
  total_records: number;
}

/**
 * Convert data points to CSV string.
 */
function toCsv(data: BulkDataPoint[]): string {
  const headers = [
    "indicator_id",
    "indicator_name",
    "country_code",
    "category",
    "date",
    "period",
    "actual",
    "forecast",
    "previous",
    "revised",
    "unit",
  ];

  const rows = data.map((point) =>
    headers
      .map((h) => {
        const val = point[h as keyof BulkDataPoint];
        if (val === null || val === undefined) return "";
        const str = String(val);
        // Escape CSV values that contain commas, quotes, or newlines
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<BulkHistoricalResponse | ApiErrorResponse | string>> {
  const startTime = Date.now();

  // Authenticate the request
  const authResult = await authenticateApiRequest(request);
  if (authResult instanceof NextResponse) {
    void logApiUsage(request, authResult.status, null, null, startTime);
    return authResult;
  }

  const { userId, apiKeyId } = authResult;

  // Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const rawParams = {
    indicator_ids: searchParams.get("indicator_ids") ?? undefined,
    from_date: searchParams.get("from_date") ?? undefined,
    to_date: searchParams.get("to_date") ?? undefined,
    format: searchParams.get("format") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
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

  const { indicator_ids, from_date, to_date, format, limit } =
    parseResult.data;
  const ids = indicator_ids.split(",").map((s) => s.trim());

  try {
    const supabase = createSupabaseServiceClient();

    // Fetch all requested indicators
    const { data: indicators, error: indicatorError } = await supabase
      .from("indicators")
      .select("id, name, country_code, category")
      .in("id", ids);

    if (indicatorError) {
      console.error("Failed to fetch indicators:", indicatorError);
      const response = createApiErrorResponse(
        "Internal server error",
        "INTERNAL_ERROR",
        500
      );
      void logApiUsage(request, 500, userId, apiKeyId, startTime);
      return response;
    }

    if (!indicators || indicators.length === 0) {
      const response = createApiErrorResponse(
        "No matching indicators found",
        "NOT_FOUND",
        404
      );
      void logApiUsage(request, 404, userId, apiKeyId, startTime);
      return response;
    }

    // Build indicator lookup map
    const indicatorMap = new Map(
      indicators.map((ind) => [ind.id, ind])
    );

    // Fetch releases for all indicators
    let query = supabase
      .from("releases")
      .select("id, indicator_id, release_at, period, actual, forecast, previous, revised, unit")
      .in("indicator_id", ids)
      .order("indicator_id", { ascending: true })
      .order("release_at", { ascending: true })
      .limit(limit * ids.length);

    if (from_date) {
      query = query.gte("release_at", from_date);
    }
    if (to_date) {
      query = query.lte("release_at", to_date);
    }

    const { data: releases, error: releasesError } = await query;

    if (releasesError) {
      console.error("Failed to fetch releases:", releasesError);
      const response = createApiErrorResponse(
        "Internal server error",
        "INTERNAL_ERROR",
        500
      );
      void logApiUsage(request, 500, userId, apiKeyId, startTime);
      return response;
    }

    // Transform to data points
    const dataPoints: BulkDataPoint[] = (releases ?? [])
      .filter((rel) => indicatorMap.has(rel.indicator_id))
      .map((rel) => {
        const ind = indicatorMap.get(rel.indicator_id)!;
        return {
          indicator_id: rel.indicator_id,
          indicator_name: ind.name,
          country_code: ind.country_code,
          category: ind.category,
          date: rel.release_at,
          period: rel.period,
          actual: rel.actual,
          forecast: rel.forecast,
          previous: rel.previous,
          revised: rel.revised,
          unit: rel.unit,
        };
      });

    void logApiUsage(request, 200, userId, apiKeyId, startTime);

    // CSV response
    if (format === "csv") {
      const csv = toCsv(dataPoints);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="historical_data.csv"',
        },
      }) as NextResponse<string>;
    }

    // JSON response
    const indicatorCounts = new Map<string, number>();
    for (const point of dataPoints) {
      indicatorCounts.set(
        point.indicator_id,
        (indicatorCounts.get(point.indicator_id) ?? 0) + 1
      );
    }

    const indicatorSummaries: IndicatorSummary[] = indicators.map((ind) => ({
      id: ind.id,
      name: ind.name,
      country_code: ind.country_code,
      category: ind.category,
      data_points: indicatorCounts.get(ind.id) ?? 0,
    }));

    const responseData: BulkHistoricalResponse = {
      indicators: indicatorSummaries,
      data: dataPoints,
      total_records: dataPoints.length,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Unexpected error in bulk historical export:", error);
    const response = createApiErrorResponse(
      "Internal server error",
      "INTERNAL_ERROR",
      500
    );
    void logApiUsage(request, 500, userId, apiKeyId, startTime);
    return response;
  }
}
