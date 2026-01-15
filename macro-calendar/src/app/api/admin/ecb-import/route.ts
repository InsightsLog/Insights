import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAdminRole, logAuditAction } from "@/lib/supabase/auth";
import { importECBHistoricalData } from "@/lib/data-import/ecb-import";
import { ECB_SERIES_CONFIG, ECBSeriesId } from "@/lib/data-import/ecb-client";

/**
 * Request body schema for ECB import.
 */
const requestSchema = z.object({
  // Optional: Specific series to import. If not provided, imports all configured series.
  seriesIds: z.array(z.string()).optional(),
  // Optional: Start period for import. Defaults to 2014-01 (10+ years of data).
  startPeriod: z.string().regex(/^\d{4}(-\d{2})?$/, "Start period must be in YYYY or YYYY-MM format").optional(),
});

/**
 * POST /api/admin/ecb-import
 * 
 * Triggers an ECB historical data import for the configured series.
 * Requires admin authentication.
 * 
 * This endpoint allows admins to import and update economic data from ECB
 * (European Central Bank) Statistical Data Warehouse. No API key is required.
 * Existing data is deduplicated and updated.
 * 
 * Request body (optional):
 * {
 *   "seriesIds": ["ICP.M.U2.N.000000.4.ANR", ...],  // Optional: specific series to import
 *   "startPeriod": "2014-01"                        // Optional: start period (default: 2014-01)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Import completed",
 *   "result": {
 *     "totalSeries": 11,
 *     "successfulSeries": 11,
 *     "failedSeries": 0,
 *     "totalObservations": 3000,
 *     "totalInserted": 2500,
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
    const validSeriesIds = Object.keys(ECB_SERIES_CONFIG) as ECBSeriesId[];
    if (body.seriesIds) {
      const invalidSeries = body.seriesIds.filter(
        (id) => !validSeriesIds.includes(id as ECBSeriesId)
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

    // Run the import (ECB doesn't require an API key)
    const result = await importECBHistoricalData({
      startPeriod: body.startPeriod,
      seriesIds: body.seriesIds as ECBSeriesId[] | undefined,
    });

    // Log the action to audit log
    await logAuditAction(
      adminCheck.userId!,
      "upload",
      "ecb_import",
      null,
      {
        totalSeries: result.totalSeries,
        successfulSeries: result.successfulSeries,
        failedSeries: result.failedSeries,
        totalObservations: result.totalObservations,
        totalInserted: result.totalInserted,
        totalUpdated: result.totalUpdated,
        startPeriod: body.startPeriod ?? "2014-01",
        seriesIds: body.seriesIds ?? "all",
      }
    );

    // Return success response
    return NextResponse.json({
      success: result.failedSeries === 0,
      message: result.failedSeries === 0 
        ? "ECB import completed successfully"
        : `ECB import completed with ${result.failedSeries} failed series`,
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
    console.error("ECB import error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error during ECB import",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/ecb-import
 * 
 * Returns information about the ECB import feature, including:
 * - Available series that can be imported
 * - ECB SDW is free and open, no API key required
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

    // ECB SDW is always available (no API key required)
    const isConfigured = true;

    // Return available series
    const availableSeries = Object.entries(ECB_SERIES_CONFIG).map(([id, config]) => ({
      id,
      name: config.name,
      category: config.category,
      countryCode: config.countryCode,
      frequency: config.frequency,
      dataflow: config.dataflow,
    }));

    return NextResponse.json({
      configured: isConfigured,
      message: "ECB Statistical Data Warehouse is free and open. No API key required.",
      keyHint: "No API key needed",
      availableSeries,
      totalSeries: availableSeries.length,
    });
  } catch (error) {
    console.error("ECB import status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
