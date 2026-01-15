import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAdminRole, logAuditAction } from "@/lib/supabase/auth";
import { getFredApiKey } from "@/lib/env";
import { importFredHistoricalData } from "@/lib/data-import/fred-import";
import { FRED_SERIES_CONFIG, FredSeriesId } from "@/lib/data-import/fred-client";

/**
 * Request body schema for FRED import.
 */
const requestSchema = z.object({
  // Optional: Specific series to import. If not provided, imports all configured series.
  seriesIds: z.array(z.string()).optional(),
  // Optional: Start date for import. Defaults to 2014-01-01 (10+ years of data).
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format").optional(),
});

/**
 * POST /api/admin/fred-import
 * 
 * Triggers a FRED historical data import for the configured series.
 * Requires admin authentication.
 * 
 * This endpoint allows admins to import real economic data from FRED
 * (Federal Reserve Economic Data) API to replace seed/test data.
 * 
 * Request body (optional):
 * {
 *   "seriesIds": ["GDPC1", "UNRATE", ...],  // Optional: specific series to import
 *   "startDate": "2014-01-01"               // Optional: start date (default: 2014-01-01)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Import completed",
 *   "result": {
 *     "totalSeries": 16,
 *     "successfulSeries": 16,
 *     "failedSeries": 0,
 *     "totalObservations": 5000,
 *     "totalInserted": 4500,
 *     "totalUpdated": 500,
 *     "totalSkipped": 0
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const adminCheck = await checkAdminRole();
    
    if (!adminCheck.isAdmin) {
      if (adminCheck.userId) {
        return NextResponse.json(
          { error: "Access denied: Admin role required" },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: "Authentication required: Sign in with an admin account" },
        { status: 401 }
      );
    }

    // Check if FRED API key is configured
    const fredApiKey = getFredApiKey();
    if (!fredApiKey) {
      return NextResponse.json(
        { 
          error: "FRED API key not configured",
          message: "Set FRED_API_KEY environment variable in Vercel. Get a free API key at https://fred.stlouisfed.org/docs/api/api_key.html"
        },
        { status: 400 }
      );
    }

    // Parse and validate request body
    let body: z.infer<typeof requestSchema> = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = requestSchema.parse(JSON.parse(text));
      }
    } catch (parseError) {
      if (parseError instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid request body", details: parseError.errors },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate series IDs if provided
    const validSeriesIds = Object.keys(FRED_SERIES_CONFIG) as FredSeriesId[];
    if (body.seriesIds) {
      const invalidSeries = body.seriesIds.filter(
        (id) => !validSeriesIds.includes(id as FredSeriesId)
      );
      if (invalidSeries.length > 0) {
        return NextResponse.json(
          { 
            error: "Invalid series IDs",
            invalidSeries,
            validSeriesIds 
          },
          { status: 400 }
        );
      }
    }

    // Run the import
    const result = await importFredHistoricalData({
      apiKey: fredApiKey,
      startDate: body.startDate,
      seriesIds: body.seriesIds as FredSeriesId[] | undefined,
    });

    // Log the action to audit log
    await logAuditAction(
      adminCheck.userId!,
      "upload",
      "fred_import",
      null,
      {
        totalSeries: result.totalSeries,
        successfulSeries: result.successfulSeries,
        failedSeries: result.failedSeries,
        totalObservations: result.totalObservations,
        totalInserted: result.totalInserted,
        totalUpdated: result.totalUpdated,
        startDate: body.startDate ?? "2014-01-01",
        seriesIds: body.seriesIds ?? "all",
      }
    );

    // Return success response
    return NextResponse.json({
      success: result.failedSeries === 0,
      message: result.failedSeries === 0 
        ? "FRED import completed successfully"
        : `FRED import completed with ${result.failedSeries} failed series`,
      result: {
        totalSeries: result.totalSeries,
        successfulSeries: result.successfulSeries,
        failedSeries: result.failedSeries,
        totalObservations: result.totalObservations,
        totalInserted: result.totalInserted,
        totalUpdated: result.totalUpdated,
        totalSkipped: result.totalSkipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    });
  } catch (error) {
    console.error("FRED import error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error during FRED import",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/fred-import
 * 
 * Returns information about the FRED import feature, including:
 * - Whether FRED API key is configured
 * - Available series that can be imported
 * 
 * Requires admin authentication.
 */
export async function GET() {
  try {
    // Check admin authentication
    const adminCheck = await checkAdminRole();
    
    if (!adminCheck.isAdmin) {
      if (adminCheck.userId) {
        return NextResponse.json(
          { error: "Access denied: Admin role required" },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: "Authentication required: Sign in with an admin account" },
        { status: 401 }
      );
    }

    // Check if FRED API key is configured
    const fredApiKey = getFredApiKey();
    const isConfigured = !!fredApiKey;

    // Return available series
    const availableSeries = Object.entries(FRED_SERIES_CONFIG).map(([id, config]) => ({
      id,
      name: config.name,
      category: config.category,
      countryCode: config.countryCode,
    }));

    return NextResponse.json({
      configured: isConfigured,
      message: isConfigured 
        ? "FRED API is configured and ready for import"
        : "FRED API key not configured. Set FRED_API_KEY environment variable.",
      keyHint: isConfigured ? "API key is set" : "Get a free API key at https://fred.stlouisfed.org/docs/api/api_key.html",
      availableSeries,
      totalSeries: availableSeries.length,
    });
  } catch (error) {
    console.error("FRED import status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
