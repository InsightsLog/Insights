import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAdminRole, logAuditAction } from "@/lib/supabase/auth";
import { getBLSApiKey } from "@/lib/env";
import { importBLSHistoricalData } from "@/lib/data-import/bls-import";
import { BLS_SERIES_CONFIG, BLSSeriesId } from "@/lib/data-import/bls-client";

/**
 * Request body schema for BLS import.
 */
const requestSchema = z.object({
  // Optional: Specific series to import. If not provided, imports all configured series.
  seriesIds: z.array(z.string()).optional(),
  // Optional: Start year for import. Defaults to 2014 (10+ years of data).
  startYear: z.string().regex(/^\d{4}$/, "Start year must be in YYYY format").optional(),
  // Optional: End year for import. Defaults to current year.
  endYear: z.string().regex(/^\d{4}$/, "End year must be in YYYY format").optional(),
});

/**
 * POST /api/admin/bls-import
 * 
 * Triggers a BLS historical data import for the configured series.
 * Requires admin authentication.
 * 
 * This endpoint allows admins to import real economic data from BLS
 * (Bureau of Labor Statistics) API to replace seed/test data.
 * 
 * Request body (optional):
 * {
 *   "seriesIds": ["LNS14000000", "CUUR0000SA0", ...],  // Optional: specific series to import
 *   "startYear": "2014",                               // Optional: start year (default: 2014)
 *   "endYear": "2024"                                  // Optional: end year (default: current year)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Import completed",
 *   "result": {
 *     "totalSeries": 17,
 *     "successfulSeries": 17,
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
          { error: "Invalid request body", details: parseError.issues },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate series IDs if provided
    const validSeriesIds = Object.keys(BLS_SERIES_CONFIG) as BLSSeriesId[];
    if (body.seriesIds) {
      const invalidSeries = body.seriesIds.filter(
        (id) => !validSeriesIds.includes(id as BLSSeriesId)
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

    // Get API key from environment (optional for BLS)
    const blsApiKey = getBLSApiKey();

    // Run the import
    const result = await importBLSHistoricalData({
      apiKey: blsApiKey ?? undefined,
      startYear: body.startYear,
      endYear: body.endYear,
      seriesIds: body.seriesIds as BLSSeriesId[] | undefined,
    });

    // Log the action to audit log
    await logAuditAction(
      adminCheck.userId!,
      "upload",
      "bls_import",
      null,
      {
        totalSeries: result.totalSeries,
        successfulSeries: result.successfulSeries,
        failedSeries: result.failedSeries,
        totalObservations: result.totalObservations,
        totalInserted: result.totalInserted,
        totalUpdated: result.totalUpdated,
        startYear: body.startYear ?? "2014",
        endYear: body.endYear ?? new Date().getFullYear().toString(),
        seriesIds: body.seriesIds ?? "all",
        hasApiKey: !!blsApiKey,
      }
    );

    // Return success response
    return NextResponse.json({
      success: result.failedSeries === 0,
      message: result.failedSeries === 0 
        ? "BLS import completed successfully"
        : `BLS import completed with ${result.failedSeries} failed series`,
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
    console.error("BLS import error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error during BLS import",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/bls-import
 * 
 * Returns information about the BLS import feature, including:
 * - Whether BLS API key is configured
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

    // Check if BLS API key is configured
    const blsApiKey = getBLSApiKey();
    const isConfigured = !!blsApiKey;

    // Return available series
    const availableSeries = Object.entries(BLS_SERIES_CONFIG).map(([id, config]) => ({
      id,
      name: config.name,
      category: config.category,
      countryCode: config.countryCode,
      frequency: config.frequency,
    }));

    return NextResponse.json({
      configured: isConfigured,
      message: isConfigured 
        ? "BLS API key is configured (500 queries/day, 20 years of data)"
        : "BLS API key not configured. Running in limited mode (25 queries/day, 10 years of data). Register at https://data.bls.gov/registrationEngine/",
      keyHint: isConfigured 
        ? "API key is set" 
        : "Set BLS_API_KEY environment variable for higher limits",
      limits: {
        queriesPerDay: isConfigured ? 500 : 25,
        yearsPerQuery: isConfigured ? 20 : 10,
        seriesPerQuery: isConfigured ? 50 : 25,
      },
      availableSeries,
      totalSeries: availableSeries.length,
    });
  } catch (error) {
    console.error("BLS import status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
