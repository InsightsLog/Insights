import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { syncReleaseSchedules } from "@/lib/sync/schedule-sync";

/**
 * POST /api/cron/sync-release-schedules
 * 
 * Scheduled cron job that fetches upcoming release times from data sources
 * and updates the releases table. Runs daily via Vercel Cron.
 * 
 * Authentication: Requires CRON_SECRET header
 * 
 * Task: T403 - Add schedule sync cron job
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication: Verify CRON_SECRET
    const serverEnv = getServerEnv();
    const authHeader = request.headers.get("authorization");
    
    // CRON_SECRET is optional, so only verify if it's configured
    if (serverEnv.CRON_SECRET) {
      const expectedAuth = `Bearer ${serverEnv.CRON_SECRET}`;
      
      if (!authHeader || authHeader !== expectedAuth) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid or missing CRON_SECRET" },
          { status: 401 }
        );
      }
    }

    // Execute sync
    const startTime = Date.now();
    const results = await syncReleaseSchedules();
    const duration = Date.now() - startTime;

    // Aggregate results
    const totalRecords = results.reduce((sum, r) => sum + r.recordsProcessed, 0);
    const hasFailures = results.some(r => r.status === "failed");
    const hasPartial = results.some(r => r.status === "partial");
    
    let overallStatus: "success" | "partial" | "failed";
    if (hasFailures && results.every(r => r.status === "failed")) {
      overallStatus = "failed";
    } else if (hasFailures || hasPartial) {
      overallStatus = "partial";
    } else {
      overallStatus = "success";
    }

    // Return summary
    return NextResponse.json({
      status: overallStatus,
      duration_ms: duration,
      total_records_processed: totalRecords,
      sources_synced: results.length,
      results: results.map(r => ({
        status: r.status,
        records_processed: r.recordsProcessed,
        error_message: r.errorMessage,
      })),
    });

  } catch (error) {
    console.error("Cron sync-release-schedules error:", error);
    
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/sync-release-schedules
 * 
 * Returns method not allowed - this endpoint only accepts POST
 */
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to trigger sync." },
    { status: 405 }
  );
}
