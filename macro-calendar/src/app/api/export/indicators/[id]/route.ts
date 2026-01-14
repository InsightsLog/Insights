/**
 * GET /api/export/indicators/:id - Export indicator historical data
 *
 * Path parameters:
 * - id: Indicator UUID
 *
 * Query parameters:
 * - format: Export format ("csv" or "json", default "csv")
 *
 * Public endpoint - no authentication required.
 *
 * Task: T340 - Add data export functionality
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exportIndicatorHistory, type ExportFormat } from "@/app/actions/export";

/**
 * Zod schema for query parameters validation.
 */
const queryParamsSchema = z.object({
  format: z.enum(["csv", "json"]).default("csv"),
});

// Page props type for Next.js dynamic route
type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  { params }: RouteProps
): Promise<NextResponse> {
  const { id } = await params;

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
  const result = await exportIndicatorHistory(id, format as ExportFormat);

  if (!result.success) {
    // Return appropriate status codes based on error
    if (result.error === "Indicator not found") {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    if (result.error === "Invalid indicator ID format") {
      return NextResponse.json({ error: result.error }, { status: 400 });
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
