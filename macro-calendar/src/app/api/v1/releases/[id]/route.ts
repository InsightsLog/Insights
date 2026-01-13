/**
 * GET /api/v1/releases/:id - Get a single release with indicator
 *
 * Path parameters:
 * - id: Release UUID
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
 * Zod schema for path parameter validation.
 */
const pathParamsSchema = z.object({
  id: z.string().uuid("Invalid release ID format"),
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ReleaseWithIndicator | ApiErrorResponse>> {
  // Authenticate the request
  const authResult = await authenticateApiRequest(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  // Validate path parameter
  const resolvedParams = await params;
  const pathParseResult = pathParamsSchema.safeParse({ id: resolvedParams.id });
  if (!pathParseResult.success) {
    return createApiErrorResponse(
      "Invalid release ID format",
      "INVALID_PARAMETER",
      400
    );
  }

  const { id } = pathParseResult.data;

  try {
    const supabase = createSupabaseServiceClient();

    // Fetch the release with indicator
    const { data: release, error: releaseError } = await supabase
      .from("releases")
      .select(
        `
        id, indicator_id, release_at, period, actual, forecast, previous, revised, unit, revision_history, created_at,
        indicators!inner(id, name, country_code, category, source_name, source_url, created_at)
      `
      )
      .eq("id", id)
      .single();

    if (releaseError) {
      // PGRST116 is "no rows returned"
      if (releaseError.code === "PGRST116") {
        return createApiErrorResponse("Release not found", "NOT_FOUND", 404);
      }
      console.error("Failed to fetch release:", releaseError);
      return createApiErrorResponse(
        "Internal server error",
        "INTERNAL_ERROR",
        500
      );
    }

    // Supabase returns embedded relations as arrays or single objects
    const indicatorData = Array.isArray(release.indicators)
      ? release.indicators[0]
      : release.indicators;

    // Guard against missing indicator data (shouldn't happen with inner join, but be safe)
    if (!indicatorData) {
      console.error("Release has no indicator data:", release.id);
      return createApiErrorResponse(
        "Internal server error",
        "INTERNAL_ERROR",
        500
      );
    }

    const response: ReleaseWithIndicator = {
      id: release.id,
      indicator_id: release.indicator_id,
      release_at: release.release_at,
      period: release.period,
      actual: release.actual,
      forecast: release.forecast,
      previous: release.previous,
      revised: release.revised,
      unit: release.unit,
      revision_history: release.revision_history as Revision[] | undefined,
      created_at: release.created_at,
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

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error fetching release:", error);
    return createApiErrorResponse(
      "Internal server error",
      "INTERNAL_ERROR",
      500
    );
  }
}
