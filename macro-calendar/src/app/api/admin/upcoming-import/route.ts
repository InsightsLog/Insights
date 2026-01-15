import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAdminRole, logAuditAction } from "@/lib/supabase/auth";
import { importCMEEvents } from "@/lib/data-import/cme-import";

/**
 * Request body schema for upcoming events import.
 */
const requestSchema = z.object({
  // Optional: Number of months to import (default: 2)
  months: z.number().min(1).max(6).optional(),
});

/**
 * POST /api/admin/upcoming-import
 * 
 * Triggers an upcoming economic events import from CME Group.
 * No API key required - uses web scraping of CME's public calendar.
 * Automatically detects and tracks schedule changes.
 * 
 * Requires admin authentication.
 * 
 * Request body (optional):
 * {
 *   "months": 2  // Number of months to import (default: 2, max: 6)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Import completed",
 *   "result": {
 *     "source": { ... },
 *     "totalEvents": 150,
 *     "releasesCreated": 120,
 *     "schedulesChanged": [...],
 *     ...
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

    // Run the CME import
    const result = await importCMEEvents({
      months: body.months,
    });

    // Log the action to audit log
    await logAuditAction(
      adminCheck.userId!,
      "upload",
      "upcoming_import",
      null,
      {
        months: body.months ?? 2,
        source: "CME Group",
        totalEvents: result.totalEvents,
        releasesCreated: result.releasesCreated,
        releasesUpdated: result.releasesUpdated,
        schedulesChanged: result.schedulesChanged.length,
        countriesCovered: result.countriesCovered.length,
      }
    );

    // Return success response
    const hasErrors = result.errors.length > 0;
    return NextResponse.json({
      success: !hasErrors || result.releasesCreated > 0,
      message: hasErrors
        ? `Import completed with ${result.errors.length} errors`
        : "Upcoming events import completed successfully",
      result: {
        source: result.source,
        totalEvents: result.totalEvents,
        indicatorsCreated: result.indicatorsCreated,
        releasesCreated: result.releasesCreated,
        releasesUpdated: result.releasesUpdated,
        releasesSkipped: result.releasesSkipped,
        schedulesChanged: result.schedulesChanged.slice(0, 10),
        countriesCovered: result.countriesCovered,
        errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
      },
    });
  } catch (error) {
    console.error("Upcoming import error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error during upcoming events import",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/upcoming-import
 * 
 * Returns information about the upcoming events import feature.
 * CME Group is the data source - no API keys required.
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

    return NextResponse.json({
      configured: true, // CME doesn't require API keys
      source: {
        name: "CME Group",
        description: "Economic Releases Calendar",
        coverage: "Global economic events (US, EU, JP, GB, etc.)",
        apiKeyRequired: false,
        features: [
          "No API key required - uses web scraping",
          "Automatic schedule change detection",
          "Event time tracking and alerts",
          "2 months of upcoming events",
        ],
        url: "https://www.cmegroup.com/education/events/economic-releases-calendar.html",
      },
      message: "CME Group calendar is ready. No API keys required.",
      supportedCountries: [
        "United States", "Japan", "Germany", "United Kingdom", 
        "European Union", "France", "Italy", "Spain", "Canada", 
        "Australia", "New Zealand", "Switzerland", "China", "India"
      ],
    });
  } catch (error) {
    console.error("Upcoming import status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
