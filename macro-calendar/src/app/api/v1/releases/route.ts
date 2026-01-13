/**
 * GET /api/v1/releases - List releases with pagination
 *
 * Query parameters:
 * - indicator_id: Filter by indicator UUID
 * - from_date: Filter releases from this date (ISO 8601)
 * - to_date: Filter releases until this date (ISO 8601)
 * - limit: Number of results to return (1-100, default 20)
 * - offset: Number of results to skip for pagination (default 0)
 *
 * Requires valid API key in Authorization header.
 *
 * Task: T312 - Add /api/v1/releases endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import {
  authenticateApiRequest,
  createApiErrorResponse,
  type ApiErrorResponse,
} from "@/lib/api/auth";

/**
 * Zod schema for query parameters validation.
 */
const queryParamsSchema = z.object({
  indicator_id: z.string().uuid("Invalid indicator_id format").optional(),
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
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Indicator type for embedded data.
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
 * Release type with indicator included.
 */
interface ReleaseWithIndicator {
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
  indicator: Indicator;
}

/**
 * Pagination metadata type.
 */
interface Pagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/**
 * Response type for the releases list endpoint.
 */
interface ReleasesListResponse {
  data: ReleaseWithIndicator[];
  pagination: Pagination;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<ReleasesListResponse | ApiErrorResponse>> {
  // Authenticate the request
  const authResult = await authenticateApiRequest(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  // Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const rawParams = {
    indicator_id: searchParams.get("indicator_id") ?? undefined,
    from_date: searchParams.get("from_date") ?? undefined,
    to_date: searchParams.get("to_date") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  };

  const parseResult = queryParamsSchema.safeParse(rawParams);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return createApiErrorResponse(
      `Invalid parameter: ${firstError?.path.join(".")} - ${firstError?.message}`,
      "INVALID_PARAMETER",
      400
    );
  }

  const { indicator_id, from_date, to_date, limit, offset } = parseResult.data;

  try {
    const supabase = createSupabaseServiceClient();

    // Build the query with indicator join
    let query = supabase
      .from("releases")
      .select(
        `
        id, indicator_id, release_at, period, actual, forecast, previous, revised, unit, revision_history, created_at,
        indicators!inner(id, name, country_code, category, source_name, source_url, created_at)
      `,
        { count: "exact" }
      );

    // Apply filters
    if (indicator_id) {
      query = query.eq("indicator_id", indicator_id);
    }
    if (from_date) {
      query = query.gte("release_at", from_date);
    }
    if (to_date) {
      query = query.lte("release_at", to_date);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Order by release date (most recent first)
    query = query.order("release_at", { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error("Failed to fetch releases:", error);
      return createApiErrorResponse(
        "Internal server error",
        "INTERNAL_ERROR",
        500
      );
    }

    const total = count ?? 0;
    const releases: ReleaseWithIndicator[] = (data ?? [])
      .filter((rel) => {
        // Skip any releases without indicator data (shouldn't happen with inner join, but guard anyway)
        const indicatorData = Array.isArray(rel.indicators)
          ? rel.indicators[0]
          : rel.indicators;
        return indicatorData != null;
      })
      .map((rel) => {
        // Supabase returns embedded relations as arrays or single objects
        const indicatorData = Array.isArray(rel.indicators)
          ? rel.indicators[0]
          : rel.indicators;

        return {
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
          indicator: {
            id: indicatorData.id,
            name: indicatorData.name,
            country_code: indicatorData.country_code,
            category: indicatorData.category,
            source_name: indicatorData.source_name,
            source_url: indicatorData.source_url,
            created_at: indicatorData.created_at,
          },
        };
      });

    const response: ReleasesListResponse = {
      data: releases,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + releases.length < total,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error fetching releases:", error);
    return createApiErrorResponse(
      "Internal server error",
      "INTERNAL_ERROR",
      500
    );
  }
}
