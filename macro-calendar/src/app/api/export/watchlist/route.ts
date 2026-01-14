/**
 * GET /api/export/watchlist - Export watchlist releases
 *
 * Query parameters:
 * - format: Export format ("csv" or "json", default "csv")
 *
 * Requires authentication via session cookie.
 *
 * Task: T340 - Add data export functionality
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exportWatchlistReleases, type ExportFormat } from "@/app/actions/export";

/**
 * Zod schema for query parameters validation.
 */
const queryParamsSchema = z.object({
  format: z.enum(["csv", "json"]).default("csv"),
});

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  // Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const rawParams = {
    format: searchParams.get("format") ?? undefined,
  };

  const parseResult = queryParamsSchema.safeParse(rawParams);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid format parameter. Use 'csv' or 'json'." },
      { status: 400 }
    );
  }

  const { format } = parseResult.data;

  // Call the export action
  const result = await exportWatchlistReleases(format as ExportFormat);

  if (!result.success) {
    // Return appropriate status codes based on error
    if (result.error === "Not authenticated") {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    if (result.error === "No indicators in watchlist") {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Return the file as a download
  return new NextResponse(result.data, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
