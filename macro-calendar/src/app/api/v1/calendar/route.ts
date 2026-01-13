/**
 * GET /api/v1/calendar - Get upcoming releases
 *
 * Query parameters:
 * - days: Number of days to include (1-90, default 7)
 * - country: Filter by country code (e.g., US, EU, GB)
 * - category: Filter by category (e.g., Employment, Inflation, GDP)
 *
 * Requires valid API key in Authorization header.
 *
 * Task: T313 - Add /api/v1/calendar endpoint
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
 * Zod schema for query parameters validation.
 */
const queryParamsSchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  country: z
    .string()
    .min(2)
    .max(3)
    .transform((v) => v.toUpperCase())
    .optional(),
  category: z.string().optional(),
});

/**
 * Calendar event type matching the OpenAPI spec.
 */
interface CalendarEvent {
  release_id: string;
  release_at: string;
  indicator_id: string;
  indicator_name: string;
  country_code: string;
  category: string;
  period: string;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  has_revisions: boolean;
}

/**
 * Metadata for the calendar response.
 */
interface CalendarMeta {
  from_date: string;
  to_date: string;
  total_events: number;
}

/**
 * Response type for the calendar endpoint.
 */
interface CalendarResponse {
  data: CalendarEvent[];
  meta: CalendarMeta;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<CalendarResponse | ApiErrorResponse>> {
  const startTime = Date.now();

  // Authenticate the request
  const authResult = await authenticateApiRequest(request);
  if (authResult instanceof NextResponse) {
    // Log failed auth attempts (T314 - API usage tracking)
    void logApiUsage(request, authResult.status, null, null, startTime);
    return authResult;
  }

  const { userId, apiKeyId } = authResult;

  // Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const rawParams = {
    days: searchParams.get("days") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    category: searchParams.get("category") ?? undefined,
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

  const { days, country, category } = parseResult.data;

  try {
    const supabase = createSupabaseServiceClient();

    // Calculate date range
    const now = new Date();
    const fromDate = now.toISOString();
    const toDate = new Date(
      now.getTime() + days * 24 * 60 * 60 * 1000
    ).toISOString();

    // Build the query with indicator join
    let query = supabase
      .from("releases")
      .select(
        `
        id, indicator_id, release_at, period, actual, forecast, previous, revision_history,
        indicators!inner(id, name, country_code, category)
      `
      )
      .gte("release_at", fromDate)
      .lte("release_at", toDate);

    // Apply country filter via indicator join
    if (country) {
      query = query.eq("indicators.country_code", country);
    }

    // Apply category filter via indicator join
    if (category) {
      query = query.eq("indicators.category", category);
    }

    // Order by release date (ascending for upcoming events)
    query = query.order("release_at", { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch calendar events:", error);
      const response = createApiErrorResponse(
        "Internal server error",
        "INTERNAL_ERROR",
        500
      );
      void logApiUsage(request, 500, userId, apiKeyId, startTime);
      return response;
    }

    // Helper to extract indicator data from Supabase embedded relation response
    // Supabase may return embedded relations as arrays or single objects
    const getIndicatorData = (
      rel: (typeof data)[number]
    ): { id: string; name: string; country_code: string; category: string } | null => {
      const indicatorData = Array.isArray(rel.indicators)
        ? rel.indicators[0]
        : rel.indicators;
      return indicatorData ?? null;
    };

    const events: CalendarEvent[] = (data ?? [])
      .filter((rel) => getIndicatorData(rel) != null)
      .map((rel) => {
        const indicatorData = getIndicatorData(rel)!;

        // Check for revisions
        const hasRevisions =
          Array.isArray(rel.revision_history) &&
          rel.revision_history.length > 0;

        return {
          release_id: rel.id,
          release_at: rel.release_at,
          indicator_id: rel.indicator_id,
          indicator_name: indicatorData.name,
          country_code: indicatorData.country_code,
          category: indicatorData.category,
          period: rel.period,
          forecast: rel.forecast,
          previous: rel.previous,
          actual: rel.actual,
          has_revisions: hasRevisions,
        };
      });

    const responseData: CalendarResponse = {
      data: events,
      meta: {
        from_date: fromDate,
        to_date: toDate,
        total_events: events.length,
      },
    };

    // Log successful API request (T314 - API usage tracking)
    void logApiUsage(request, 200, userId, apiKeyId, startTime);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Unexpected error fetching calendar:", error);
    const response = createApiErrorResponse(
      "Internal server error",
      "INTERNAL_ERROR",
      500
    );
    void logApiUsage(request, 500, userId, apiKeyId, startTime);
    return response;
  }
}
