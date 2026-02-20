/**
 * GET /api/v1/historical/:indicatorId/export - Export historical release data as CSV or JSON
 *
 * Path parameters:
 * - indicatorId: Indicator UUID
 *
 * Query parameters:
 * - format: Export format ("csv" or "json", default "csv")
 *
 * Requires valid API key in Authorization header.
 * Returns at most 5000 rows.
 * CSV headers: date, actual, consensus, previous, revised
 *
 * Task: T481 - Add CSV/JSON data export
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import {
  authenticateApiRequest,
  createApiErrorResponse,
} from "@/lib/api/auth";
import { logApiUsage } from "@/lib/api/usage-logger";

/**
 * Maximum number of rows returned per export request.
 */
const MAX_EXPORT_ROWS = 5000;

/**
 * Zod schema for path parameter validation.
 */
const pathParamsSchema = z.object({
  indicatorId: z.string().uuid("Invalid indicator ID format"),
});

/**
 * Zod schema for query parameter validation.
 */
const queryParamsSchema = z.object({
  format: z.enum(["csv", "json"]).default("csv"),
});

/**
 * A single row in the export output.
 */
interface ExportRow {
  date: string;
  actual: string | null;
  consensus: string | null;
  previous: string | null;
  revised: string | null;
}

/**
 * Escape a value for safe inclusion in a CSV cell.
 * Wraps in double quotes if the value contains commas, newlines, or quotes.
 */
function escapeCSVValue(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert export rows to CSV text.
 * Headers: date, actual, consensus, previous, revised
 */
function toCSV(rows: ExportRow[]): string {
  const headers = ["date", "actual", "consensus", "previous", "revised"];
  const lines = rows.map((r) =>
    [
      escapeCSVValue(r.date),
      escapeCSVValue(r.actual),
      escapeCSVValue(r.consensus),
      escapeCSVValue(r.previous),
      escapeCSVValue(r.revised),
    ].join(",")
  );
  return [headers.join(","), ...lines].join("\n");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> }
): Promise<NextResponse> {
  const startTime = Date.now();

  // Authenticate the request with a valid API key
  const authResult = await authenticateApiRequest(request);
  if (authResult instanceof NextResponse) {
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

  // Parse and validate format query parameter
  const { searchParams } = new URL(request.url);
  const queryParseResult = queryParamsSchema.safeParse({
    format: searchParams.get("format") ?? undefined,
  });
  if (!queryParseResult.success) {
    const response = createApiErrorResponse(
      "Invalid format parameter. Use 'csv' or 'json'.",
      "INVALID_PARAMETER",
      400
    );
    void logApiUsage(request, 400, userId, apiKeyId, startTime);
    return response;
  }

  const { format } = queryParseResult.data;

  try {
    const supabase = createSupabaseServiceClient();

    // Verify the indicator exists
    const { error: indicatorError } = await supabase
      .from("indicators")
      .select("id")
      .eq("id", indicatorId)
      .single();

    if (indicatorError) {
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

    // Fetch releases, capped at MAX_EXPORT_ROWS
    const { data, error } = await supabase
      .from("releases")
      .select("release_at, actual, forecast, previous, revised")
      .eq("indicator_id", indicatorId)
      .order("release_at", { ascending: false })
      .limit(MAX_EXPORT_ROWS);

    if (error) {
      console.error("Failed to fetch releases for export:", error);
      const response = createApiErrorResponse(
        "Internal server error",
        "INTERNAL_ERROR",
        500
      );
      void logApiUsage(request, 500, userId, apiKeyId, startTime);
      return response;
    }

    // Map DB rows to export shape (forecast → consensus in CSV)
    const rows: ExportRow[] = (data ?? []).map((r) => ({
      date: r.release_at,
      actual: r.actual,
      consensus: r.forecast,
      previous: r.previous,
      revised: r.revised,
    }));

    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `indicator-${indicatorId}-${dateStamp}`;

    void logApiUsage(request, 200, userId, apiKeyId, startTime);

    if (format === "json") {
      return new NextResponse(JSON.stringify(rows), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}.json"`,
        },
      });
    }

    return new NextResponse(toCSV(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (err) {
    console.error("Unexpected error during export:", err);
    const response = createApiErrorResponse(
      "Internal server error",
      "INTERNAL_ERROR",
      500
    );
    void logApiUsage(request, 500, userId, apiKeyId, startTime);
    return response;
  }
}
