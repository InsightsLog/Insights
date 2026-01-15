import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAdminRole, logAuditAction } from "@/lib/supabase/auth";
import { importIMFHistoricalData } from "@/lib/data-import/imf-import";
import { IMF_INDICATOR_CONFIG, IMF_COUNTRIES, IMFIndicatorId, IMFCountryCode } from "@/lib/data-import/imf-client";

/**
 * Request body schema for IMF import.
 */
const requestSchema = z.object({
  // Optional: Specific indicators to import. If not provided, imports all configured indicators.
  indicatorIds: z.array(z.string()).optional(),
  // Optional: Specific countries to import. If not provided, imports all configured countries.
  countryCodes: z.array(z.string()).optional(),
  // Optional: Start year for import. Defaults to 2014 (10+ years of data).
  startYear: z.string().regex(/^\d{4}$/, "Start year must be in YYYY format").optional(),
  // Optional: End year for import. Defaults to current year.
  endYear: z.string().regex(/^\d{4}$/, "End year must be in YYYY format").optional(),
});

/**
 * POST /api/admin/imf-import
 * 
 * Triggers an IMF historical data import for the configured indicators.
 * Requires admin authentication.
 * 
 * This endpoint allows admins to import and update economic data from IMF
 * (International Monetary Fund) World Economic Outlook. No API key is required.
 * Existing data is deduplicated and updated.
 * 
 * Request body (optional):
 * {
 *   "indicatorIds": ["NGDP_RPCH", "PCPIPCH", ...],  // Optional: specific indicators to import
 *   "countryCodes": ["US", "GB", ...],              // Optional: specific countries to import
 *   "startYear": "2014",                            // Optional: start year (default: 2014)
 *   "endYear": "2024"                               // Optional: end year (default: current year)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Import completed",
 *   "result": {
 *     "totalIndicators": 15,
 *     "totalCountries": 37,
 *     "successfulImports": 500,
 *     "failedImports": 0,
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

    // Validate indicator IDs if provided
    const validIndicatorIds = Object.keys(IMF_INDICATOR_CONFIG) as IMFIndicatorId[];
    if (body.indicatorIds) {
      const invalidIndicators = body.indicatorIds.filter(
        (id) => !validIndicatorIds.includes(id as IMFIndicatorId)
      );
      if (invalidIndicators.length > 0) {
        return NextResponse.json(
          { 
            error: "Invalid indicator IDs",
            invalidIndicators,
            validIndicatorIds 
          },
          { status: 400 }
        );
      }
    }

    // Validate country codes if provided
    const validCountryCodes = Object.keys(IMF_COUNTRIES) as IMFCountryCode[];
    if (body.countryCodes) {
      const invalidCountries = body.countryCodes.filter(
        (code) => !validCountryCodes.includes(code as IMFCountryCode)
      );
      if (invalidCountries.length > 0) {
        return NextResponse.json(
          { 
            error: "Invalid country codes",
            invalidCountries,
            validCountryCodes 
          },
          { status: 400 }
        );
      }
    }

    // Run the import (IMF doesn't require an API key)
    const result = await importIMFHistoricalData({
      startYear: body.startYear,
      endYear: body.endYear,
      indicatorIds: body.indicatorIds as IMFIndicatorId[] | undefined,
      countryCodes: body.countryCodes as IMFCountryCode[] | undefined,
    });

    // Log the action to audit log
    await logAuditAction(
      adminCheck.userId!,
      "upload",
      "imf_import",
      null,
      {
        totalIndicators: result.totalIndicators,
        totalCountries: result.totalCountries,
        successfulImports: result.successfulImports,
        failedImports: result.failedImports,
        totalObservations: result.totalObservations,
        totalInserted: result.totalInserted,
        totalUpdated: result.totalUpdated,
        startYear: body.startYear ?? "2014",
        endYear: body.endYear ?? new Date().getFullYear().toString(),
        indicatorIds: body.indicatorIds ?? "all",
        countryCodes: body.countryCodes ?? "all",
      }
    );

    // Return success response
    return NextResponse.json({
      success: result.failedImports === 0,
      message: result.failedImports === 0 
        ? "IMF import completed successfully"
        : `IMF import completed with ${result.failedImports} failed imports`,
      result: {
        totalIndicators: result.totalIndicators,
        totalCountries: result.totalCountries,
        successfulImports: result.successfulImports,
        failedImports: result.failedImports,
        totalObservations: result.totalObservations,
        totalInserted: result.totalInserted,
        totalUpdated: result.totalUpdated,
        totalSkipped: result.totalSkipped,
        errors: result.errors.length > 0 ? result.errors.slice(0, 20) : undefined,
      },
    });
  } catch (error) {
    console.error("IMF import error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error during IMF import",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/imf-import
 * 
 * Returns information about the IMF import feature, including:
 * - Available indicators that can be imported
 * - Available countries
 * - IMF API is free and open, no API key required
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

    // IMF API is always available (no API key required)
    const isConfigured = true;

    // Return available indicators
    const availableIndicators = Object.entries(IMF_INDICATOR_CONFIG).map(([id, config]) => ({
      id,
      name: config.name,
      category: config.category,
      frequency: config.frequency,
    }));

    // Return available countries
    const availableCountries = Object.entries(IMF_COUNTRIES).map(([code, name]) => ({
      code,
      name,
    }));

    return NextResponse.json({
      configured: isConfigured,
      message: "IMF World Economic Outlook API is free and open. No API key required.",
      keyHint: "No API key needed",
      availableIndicators,
      totalIndicators: availableIndicators.length,
      availableCountries,
      totalCountries: availableCountries.length,
    });
  } catch (error) {
    console.error("IMF import status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
