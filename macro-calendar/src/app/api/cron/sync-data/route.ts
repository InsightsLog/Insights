/**
 * GET /api/cron/sync-data - Scheduled data sync endpoint
 *
 * This endpoint is called by Vercel Cron to sync economic data from CME Group.
 * Runs every 2 hours to keep data fresh and detect schedule changes.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 *
 * Source: CME Group Economic Releases Calendar (no API key required)
 *
 * Task: T403.1 - Create /api/cron/sync-data endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { importCMEEvents } from "@/lib/data-import/cme-import";

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
    console.log("Cron: Starting scheduled data sync from CME Group");
    console.log("=".repeat(60));

    // Import upcoming events from CME (2 months)
    // No API key required - uses web scraping
    const result = await importCMEEvents({ months: 2 });

    const duration = Date.now() - startTime;

    console.log("");
    console.log("Cron: Sync completed in", duration, "ms");

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      source: {
        name: result.source.name,
        events: result.source.events,
        errors: result.source.errors.length,
      },
      summary: {
        total_events: result.totalEvents,
        indicators_created: result.indicatorsCreated,
        releases_created: result.releasesCreated,
        releases_updated: result.releasesUpdated,
        releases_skipped: result.releasesSkipped,
        schedule_changes: result.schedulesChanged.length,
        countries_covered: result.countriesCovered.length,
      },
      schedule_changes: result.schedulesChanged.slice(0, 10), // Include schedule changes for alerts
      errors: result.errors.slice(0, MAX_ERRORS_IN_RESPONSE),
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
