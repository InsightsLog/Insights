/**
 * GET /api/v1/indicators - List all indicators with pagination
 *
 * Query parameters:
 * - country: Filter by country code (e.g., US, EU, GB)
 * - category: Filter by category (e.g., Employment, Inflation, GDP)
 * - search: Search indicator names (case-insensitive)
 * - limit: Number of results to return (1-100, default 20)
 * - offset: Number of results to skip for pagination (default 0)
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

/**
 * Zod schema for query parameters validation.
 */
const queryParamsSchema = z.object({
  country: z
    .string()
    .min(2)
    .max(3)
    .transform((v) => v.toUpperCase())
    .optional(),
  category: z.string().optional(),
  search: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
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
 * Pagination metadata type.
 */
interface Pagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/**
 * Response type for the indicators list endpoint.
 */
interface IndicatorsListResponse {
  data: Indicator[];
  pagination: Pagination;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<IndicatorsListResponse | ApiErrorResponse>> {
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
    country: searchParams.get("country") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    search: searchParams.get("search") ?? undefined,
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

  const { country, category, search, limit, offset } = parseResult.data;

  try {
    const supabase = createSupabaseServiceClient();

    // Build the query
    let query = supabase
      .from("indicators")
      .select("id, name, country_code, category, source_name, source_url, created_at", {
        count: "exact",
      });

    // Apply filters
    if (country) {
      query = query.eq("country_code", country);
    }
    if (category) {
      query = query.eq("category", category);
    }
    if (search) {
      // Case-insensitive search on indicator name
      query = query.ilike("name", `%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Order by name for consistent results
    query = query.order("name", { ascending: true });

    const { data, error, count } = await query;

    if (error) {
      console.error("Failed to fetch indicators:", error);
      const response = createApiErrorResponse(
        "Internal server error",
        "INTERNAL_ERROR",
        500
      );
      void logApiUsage(request, 500, userId, apiKeyId, startTime);
      return response;
    }

    const total = count ?? 0;
    const indicators: Indicator[] = (data ?? []).map((ind) => ({
      id: ind.id,
      name: ind.name,
      country_code: ind.country_code,
      category: ind.category,
      source_name: ind.source_name,
      source_url: ind.source_url,
      created_at: ind.created_at,
    }));

    const response: IndicatorsListResponse = {
      data: indicators,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + indicators.length < total,
      },
    };

    // Log successful API request (T314 - API usage tracking)
    void logApiUsage(request, 200, userId, apiKeyId, startTime);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error fetching indicators:", error);
    const response = createApiErrorResponse(
      "Internal server error",
      "INTERNAL_ERROR",
      500
    );
    void logApiUsage(request, 500, userId, apiKeyId, startTime);
    return response;
  }
}
