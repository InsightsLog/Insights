/**
 * GET /api/cron/sync-data - Scheduled data sync endpoint
 *
 * This endpoint is called by Vercel Cron to sync economic data from all sources.
 * Runs every 2 hours to keep data fresh.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 *
 * Task: T403.1 - Create /api/cron/sync-data endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { importUpcomingEvents } from "@/lib/data-import/upcoming-import";

/** Maximum number of errors to include in the response */
const MAX_ERRORS_IN_RESPONSE = 10;

/**
 * Verify the request is from Vercel Cron.
 * In production, Vercel adds CRON_SECRET header for security.
 * In development, a valid secret must still be provided for security.
 */
function verifyCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Always require CRON_SECRET in production
  if (process.env.NODE_ENV === "production") {
    if (!cronSecret) {
      console.error("CRON_SECRET not configured in production");
      return false;
    }
    return authHeader === `Bearer ${cronSecret}`;
  }

  // In development: allow if secret matches or if explicitly disabled for testing
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  // If no secret in dev, require a special header to confirm intent
  const devBypass = request.headers.get("x-dev-cron-bypass");
  return devBypass === "true";
}

export async function GET(request: NextRequest) {
  // Verify the request is authorized
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    console.log("=".repeat(60));
    console.log("Cron: Starting scheduled data sync");
    console.log("=".repeat(60));

    // Import upcoming events (30 days)
    // This uses FMP, Finnhub, and Trading Economics APIs
    const result = await importUpcomingEvents({ days: 30 });

    const duration = Date.now() - startTime;

    console.log("");
    console.log("Cron: Sync completed in", duration, "ms");

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      sources: {
        fmp: {
          available: result.sources.fmp.available,
          events: result.sources.fmp.events,
          errors: result.sources.fmp.errors.length,
        },
        finnhub: {
          available: result.sources.finnhub.available,
          events: result.sources.finnhub.events,
          errors: result.sources.finnhub.errors.length,
        },
        trading_economics: {
          available: result.sources.tradingEconomics.available,
          events: result.sources.tradingEconomics.events,
          errors: result.sources.tradingEconomics.errors.length,
        },
      },
      summary: {
        total_events_from_sources: result.totalEventsFromSources,
        unique_events: result.uniqueEventsAfterDedup,
        indicators_created: result.indicatorsCreated,
        releases_created: result.releasesCreated,
        releases_skipped: result.releasesSkipped,
        countries_covered: result.countriesCovered.length,
      },
      errors: result.errors.slice(0, MAX_ERRORS_IN_RESPONSE), // Limit errors in response
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("Cron: Sync failed after", duration, "ms:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        duration_ms: duration,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
