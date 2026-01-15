import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAdminRole, logAuditAction } from "@/lib/supabase/auth";
import { getFMPApiKey, getFinnhubApiKey, getTradingEconomicsApiKey } from "@/lib/env";
import { importUpcomingEvents } from "@/lib/data-import/upcoming-import";

/**
 * Request body schema for upcoming events import.
 */
const requestSchema = z.object({
  // Optional: Number of days to import (default: 30)
  days: z.number().min(1).max(90).optional(),
});

/**
 * POST /api/admin/upcoming-import
 * 
 * Triggers an upcoming economic events import from multiple sources.
 * Uses FMP, Finnhub, and Trading Economics APIs (whichever are configured).
 * Events are deduplicated across sources.
 * 
 * Requires admin authentication.
 * 
 * Request body (optional):
 * {
 *   "days": 30  // Number of days to import (default: 30, max: 90)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Import completed",
 *   "result": {
 *     "sources": { ... },
 *     "totalEventsFromSources": 500,
 *     "uniqueEventsAfterDedup": 350,
 *     "releasesCreated": 320,
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

    // Check if at least one API key is configured
    const fmpKey = getFMPApiKey();
    const finnhubKey = getFinnhubApiKey();
    const teKey = getTradingEconomicsApiKey();

    if (!fmpKey && !finnhubKey && !teKey) {
      return NextResponse.json(
        { 
          error: "No calendar API keys configured",
          message: "Set at least one of: FMP_API_KEY, FINNHUB_API_KEY, or TRADING_ECONOMICS_API_KEY in Vercel environment variables.",
          registrationUrls: {
            fmp: "https://financialmodelingprep.com/register",
            finnhub: "https://finnhub.io/register",
            tradingEconomics: "https://tradingeconomics.com/api",
          }
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
          { error: "Invalid request body", details: parseError.issues },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Run the import
    const result = await importUpcomingEvents({
      days: body.days,
      fmpApiKey: fmpKey ?? undefined,
      finnhubApiKey: finnhubKey ?? undefined,
      teApiKey: teKey ?? undefined,
    });

    // Log the action to audit log
    await logAuditAction(
      adminCheck.userId!,
      "upload",
      "upcoming_import",
      null,
      {
        days: body.days ?? 30,
        sources: {
          fmp: result.sources.fmp.available,
          finnhub: result.sources.finnhub.available,
          tradingEconomics: result.sources.tradingEconomics.available,
        },
        totalEvents: result.totalEventsFromSources,
        uniqueEvents: result.uniqueEventsAfterDedup,
        releasesCreated: result.releasesCreated,
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
        sources: result.sources,
        totalEventsFromSources: result.totalEventsFromSources,
        uniqueEventsAfterDedup: result.uniqueEventsAfterDedup,
        indicatorsCreated: result.indicatorsCreated,
        releasesCreated: result.releasesCreated,
        releasesSkipped: result.releasesSkipped,
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
 * Returns information about the upcoming events import feature, including:
 * - Which API keys are configured
 * - Available data sources
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

    // Check which API keys are configured
    const fmpConfigured = !!getFMPApiKey();
    const finnhubConfigured = !!getFinnhubApiKey();
    const teConfigured = !!getTradingEconomicsApiKey();
    const anyConfigured = fmpConfigured || finnhubConfigured || teConfigured;

    return NextResponse.json({
      configured: anyConfigured,
      sources: {
        fmp: {
          configured: fmpConfigured,
          name: "Financial Modeling Prep",
          coverage: "Global (G20+ countries)",
          freeLimit: "250 calls/day",
          subscriptionNote: "⚠️ Premium/Ultimate plan required for economic calendar data",
          registrationUrl: "https://financialmodelingprep.com/register",
        },
        finnhub: {
          configured: finnhubConfigured,
          name: "Finnhub",
          coverage: "Global economic calendar",
          freeLimit: "60 calls/minute",
          subscriptionNote: "⚠️ Premium subscription required for economic calendar data",
          registrationUrl: "https://finnhub.io/register",
        },
        tradingEconomics: {
          configured: teConfigured,
          name: "Trading Economics",
          coverage: "Comprehensive G20+ data",
          freeLimit: "Registration required",
          subscriptionNote: "⚠️ Paid tier may be required for full access",
          registrationUrl: "https://tradingeconomics.com/api",
        },
      },
      message: anyConfigured 
        ? "At least one calendar API is configured. Note: Most calendar APIs require premium subscriptions to return data."
        : "No calendar API keys configured. Set at least one in Vercel environment variables.",
      g20Countries: [
        "Argentina", "Australia", "Brazil", "Canada", "China", "France", 
        "Germany", "India", "Indonesia", "Italy", "Japan", "Mexico", 
        "Russia", "Saudi Arabia", "South Africa", "South Korea", "Turkey", 
        "United Kingdom", "United States", "European Union"
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
